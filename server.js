// Tennis tournament tracker: a tiny zero-dependency Node server that proxies
// WTA (api.wtatennis.com) and ATP (ESPN's public tennis feed) data and serves
// the static frontend in ./public.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
// Hand-maintained list of tournaments to remove; shared with the Vercel deployment.
const HIDDEN_FILE = path.join(__dirname, "vercel-deploy", "data", "hidden.json");
const { isHidden } = require("./vercel-deploy/lib/tennis");
const photos = require("./lib/photos");
const CACHE_TTL_MS = 10 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const cache = new Map();

// `fresh` skips the cached copy (used by the player list's Update button) but still refreshes the cache.
async function getJSON(url, fresh = false) {
  const hit = cache.get(url);
  if (!fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${url}`);
  const data = await res.json();
  cache.set(url, { at: Date.now(), data });
  return data;
}

const titleCase = (s) =>
  (s || "").toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (m, p, c) => p + c.toUpperCase());

// ---------------------------------------------------------------- WTA

const WTA_API = "https://api.wtatennis.com/tennis/tournaments";

async function wtaTournaments(from, to) {
  const out = [];
  for (let page = 0; page < 20; page++) {
    const url = `${WTA_API}/?page=${page}&pageSize=100&excludeLevels=ITF&from=${from}&to=${to}`;
    const data = await getJSON(url);
    const items = data.content || [];
    out.push(...items);
    if (items.length < 100) break;
  }
  return out.map((t) => {
    const name = t.title.split(" - ")[0];
    const slug = t.tournamentGroup.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return {
      tour: "WTA",
      id: String(t.tournamentGroup.id),
      year: t.year,
      name,
      level: t.level || t.tournamentGroup.level,
      city: titleCase(t.city),
      country: t.country,
      surface: t.surface ? `${t.surface}${t.inOutdoor === "I" ? " (Indoor)" : ""}` : null,
      startDate: t.startDate,
      endDate: t.endDate,
      prizeMoney: t.prizeMoney ? `${t.prizeMoneyCurrency || ""} ${t.prizeMoney.toLocaleString("en-US")}`.trim() : null,
      drawSize: t.singlesDrawSize || null,
      url: `https://www.wtatennis.com/tournaments/${t.tournamentGroup.id}/${slug}/${t.year}/draws`,
    };
  });
}

async function wtaPlayers(id, year, fresh = false) {
  const data = await getJSON(`${WTA_API}/${id}/${year}/players`, fresh);
  const events = { singles: [], doubles: [] };
  for (const ev of data.events || []) {
    const key = ev.eventTypeCode === "LS" ? "singles" : ev.eventTypeCode === "LD" ? "doubles" : null;
    if (!key) continue;
    for (const ep of ev.eventPlayers || []) {
      events[key].push({
        names: ep.players.map((p) => titleCase(p.fullName)),
        countries: ep.players.map((p) => p.countryCode),
        ids: ep.players.map((p) => String(p.id)),
        seed: ep.seed || null,
        entry: ep.entryType || null,
      });
    }
  }
  return { source: "WTA entry list", ...events };
}

// ---------------------------------------------------------------- ATP (via ESPN)

const ESPN_ATP = "https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard";
const ymd = (d) => d.replace(/-/g, "");
// ESPN dates are midnight US-Eastern expressed in UTC (e.g. end "2026-10-19T03:59Z"
// means the event finishes on Oct 18). Shift back a few hours to get the local day.
const espnDay = (iso, shiftHours) => new Date(Date.parse(iso) - shiftHours * 3600e3).toISOString().slice(0, 10);

// ESPN doesn't publish ATP tournament levels, so they're kept here by hand, keyed by
// ESPN's tournament number (the part of the event id before the year, e.g. "10" in
// "10-2026" for Vienna). Grand Slams come from ESPN's own `major` flag. Unlisted
// tournaments show no level. Check this table when the ATP calendar changes.
const ATP_LEVELS = {
  // ATP Masters 1000
  411: "ATP Masters 1000", // Indian Wells
  713: "ATP Masters 1000", // Miami
  42: "ATP Masters 1000", // Monte-Carlo
  413: "ATP Masters 1000", // Madrid
  414: "ATP Masters 1000", // Rome
  421: "ATP Masters 1000", // Canada
  718: "ATP Masters 1000", // Cincinnati
  315: "ATP Masters 1000", // Shanghai
  13: "ATP Masters 1000", // Paris
  // ATP 500
  4: "ATP 500", // Rotterdam
  375: "ATP 500", // Rio de Janeiro
  836: "ATP 500", // Dallas
  25: "ATP 500", // Dubai
  119: "ATP 500", // Doha
  711: "ATP 500", // Acapulco
  338: "ATP 500", // Barcelona
  12: "ATP 500", // Munich
  942: "ATP 500", // Hamburg
  27: "ATP 500", // Halle
  129: "ATP 500", // Queen's Club
  888: "ATP 500", // Washington
  5: "ATP 500", // Tokyo
  959: "ATP 500", // Beijing
  10: "ATP 500", // Vienna
  23: "ATP 500", // Basel
  // ATP 250
  970: "ATP 250", // Brisbane
  925: "ATP 250", // Auckland
  971: "ATP 250", // Hong Kong
  611: "ATP 250", // Adelaide
  29: "ATP 250", // Montpellier
  299: "ATP 250", // Buenos Aires
  296: "ATP 250", // Delray Beach
  620: "ATP 250", // Santiago
  145: "ATP 250", // Houston
  28: "ATP 250", // Marrakech
  974: "ATP 250", // Bucharest
  396: "ATP 250", // Geneva
  49: "ATP 250", // Stuttgart
  415: "ATP 250", // 's-Hertogenbosch
  444: "ATP 250", // Eastbourne
  637: "ATP 250", // Mallorca
  306: "ATP 250", // Bastad
  7: "ATP 250", // Gstaad
  22: "ATP 250", // Umag
  304: "ATP 250", // Kitzbuhel
  400: "ATP 250", // Estoril
  424: "ATP 250", // Los Cabos
  363: "ATP 250", // Winston-Salem
  441: "ATP 250", // Chengdu
  1001: "ATP 250", // Hangzhou
  440: "ATP 250", // Brussels
  708: "ATP 250", // Almaty
  452: "ATP 250", // Lyon
  148: "ATP 250", // Stockholm
  // Season finals
  339: "ATP Finals", // Turin
  865: "Next Gen ATP Finals", // Jeddah
};
const atpLevel = (e) => (e.major ? "Grand Slam" : ATP_LEVELS[e.id.split("-")[0]] || null);

async function atpTournaments(from, to) {
  const data = await getJSON(`${ESPN_ATP}?dates=${ymd(from)}-${ymd(to)}`);
  return (data.events || []).map((e) => {
    const venue = (e.venue && e.venue.displayName) || "";
    const [city, ...rest] = venue.split(",").map((s) => s.trim());
    return {
      tour: "ATP",
      id: e.id,
      year: e.season && e.season.year,
      name: e.name,
      level: atpLevel(e),
      city: city || null,
      country: rest.join(", ") || null,
      surface: null,
      startDate: e.date.slice(0, 10),
      endDate: espnDay(e.endDate || e.date, 6),
      prizeMoney: null,
      drawSize: null,
      url: (e.links && e.links[0] && e.links[0].href) || null,
    };
  });
}

async function atpPlayers(id, start, end, fresh = false) {
  const data = await getJSON(`${ESPN_ATP}?dates=${ymd(start)}-${ymd(end)}`, fresh);
  const ev = (data.events || []).find((e) => e.id === id);
  const result = { source: "ESPN draw (available once the draw is made)", singles: [], doubles: [] };
  if (!ev) return result;
  const seen = { singles: new Set(), doubles: new Set() };
  for (const g of ev.groupings || []) {
    const label = (g.grouping && g.grouping.displayName) || "";
    const key = /double/i.test(label) ? "doubles" : /single/i.test(label) ? "singles" : null;
    if (!key) continue;
    for (const c of g.competitions || []) {
      for (const comp of c.competitors || []) {
        const athletes = (comp.athlete ? [comp.athlete] : (comp.roster && comp.roster.athletes) || [])
          .filter((a) => a.displayName && a.displayName !== "TBD");
        const names = athletes.map((a) => a.displayName);
        if (!names.length) continue;
        const k = names.join("/");
        if (seen[key].has(k)) continue;
        seen[key].add(k);
        result[key].push({
          names,
          countries: athletes.map((a) => (a.flag && a.flag.alt) || null),
          // ESPN athlete id, from the player card link (".../player/_/id/10954/...").
          ids: athletes.map((a) => { const m = ((a.links && a.links[0] && a.links[0].href) || "").match(/\/id\/(\d+)/); return m ? m[1] : null; }),
          seed: comp.curatedRank && comp.curatedRank.current < 99 ? String(comp.curatedRank.current) : null,
          entry: null,
        });
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------- HTTP

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// ---------------------------------------------------------------- Hidden tournaments (local editing)

const readHidden = () => JSON.parse(fs.readFileSync(HIDDEN_FILE, "utf8"));
const writeHidden = (data) => fs.writeFileSync(HIDDEN_FILE, JSON.stringify(data, null, 2) + "\n");
const sameEntry = (a, b) => a.tour === b.tour && String(a.id) === String(b.id) && (a.year ?? null) === (b.year ?? null);

// Only requests from this machine, addressed to localhost, may change the list
// (blocks other devices on the network and DNS-rebinding pages).
function isLocalRequest(req) {
  const ip = req.socket.remoteAddress || "";
  const host = (req.headers.host || "").replace(/:\d+$/, "");
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(ip) && ["localhost", "127.0.0.1", "[::1]"].includes(host);
}

function readBody(req, max = 10_000) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > max) reject(new Error("Body too large")); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// Player photos (local site only): POST { players: [{ tour, id, name }] } returns the photos already saved
// and starts looking up the missing ones in the background; `pending` counts those still being looked up,
// so the page asks again until it's 0. The live site has no photo store and returns 404 here.
const photoJobs = new Set();
async function handlePhotos(req, res) {
  if (!isLocalRequest(req)) return send(res, 403, { error: "Photos are only available on the local site" });
  if (req.method !== "POST" || !/json/.test(req.headers["content-type"] || "")) return send(res, 400, { error: "POST JSON expected" });
  const body = JSON.parse((await readBody(req, 200_000)) || "{}");
  const players = (Array.isArray(body.players) ? body.players : [])
    .filter((p) => ["WTA", "ATP"].includes(p.tour) && /^\d+$/.test(String(p.id)) && typeof p.name === "string")
    .map((p) => ({ tour: p.tour, id: String(p.id), name: p.name.slice(0, 100) }))
    .slice(0, 600);
  const todo = photos.missing(players).filter((p) => !photoJobs.has(photos.photoKey(p.tour, p.id)));
  if (todo.length) {
    todo.forEach((p) => photoJobs.add(photos.photoKey(p.tour, p.id)));
    photos.ensurePhotos(todo).catch((e) => console.warn("Photos:", e.message))
      .finally(() => todo.forEach((p) => photoJobs.delete(photos.photoKey(p.tour, p.id))));
  }
  const pending = players.filter((p) => photoJobs.has(photos.photoKey(p.tour, p.id))).length;
  return send(res, 200, { photos: photos.photoMap(players), pending });
}

async function handleHidden(req, url, res) {
  const local = isLocalRequest(req);
  if (req.method === "GET") return send(res, 200, { editable: local, tournaments: local ? readHidden().tournaments || [] : [] });
  if (!local) return send(res, 403, { error: "Editing is only allowed from this computer" });

  if (req.method === "POST") {
    if (!/^application\/json\b/.test(req.headers["content-type"] || "")) return send(res, 415, { error: "Send JSON" });
    const b = JSON.parse(await readBody(req));
    const entry = { tour: String(b.tour || "").toUpperCase(), id: String(b.id || "") };
    if (!["ATP", "WTA"].includes(entry.tour) || !/^[\w-]{1,32}$/.test(entry.id)) return send(res, 400, { error: "tour must be ATP or WTA, and id is required" });
    if (b.year != null) entry.year = Number(b.year);
    if (b.name) entry.name = String(b.name).slice(0, 200);
    if (b.note) entry.note = String(b.note).slice(0, 500);
    const data = readHidden();
    data.tournaments = data.tournaments || [];
    if (!data.tournaments.some((h) => sameEntry(h, entry))) data.tournaments.push(entry);
    writeHidden(data);
    return send(res, 200, { tournaments: data.tournaments });
  }

  if (req.method === "DELETE") {
    const target = { tour: (url.searchParams.get("tour") || "").toUpperCase(), id: url.searchParams.get("id") || "" };
    if (url.searchParams.get("year")) target.year = Number(url.searchParams.get("year"));
    const data = readHidden();
    data.tournaments = (data.tournaments || []).filter((h) => !sameEntry(h, target));
    writeHidden(data);
    return send(res, 200, { tournaments: data.tournaments });
  }
  send(res, 405, { error: "Method not allowed" });
}

async function handleApi(req, url, res) {
  const q = url.searchParams;
  if (url.pathname === "/api/tournaments") {
    const from = q.get("from"), to = q.get("to");
    if (!isDate(from) || !isDate(to)) return send(res, 400, { error: "from/to must be YYYY-MM-DD" });
    const tours = (q.get("tour") || "ATP,WTA").toUpperCase().split(",");
    const jobs = [];
    if (tours.includes("WTA")) jobs.push(wtaTournaments(from, to));
    if (tours.includes("ATP")) jobs.push(atpTournaments(from, to));
    const settled = await Promise.allSettled(jobs);
    const hidden = readHidden().tournaments || [];
    const tournaments = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])).filter((t) => !isHidden(t, hidden));
    const errors = settled.filter((s) => s.status === "rejected").map((s) => s.reason.message);
    tournaments.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.tour.localeCompare(b.tour));
    return send(res, 200, { tournaments, errors });
  }
  if (url.pathname === "/api/players") {
    const tour = (q.get("tour") || "").toUpperCase();
    const fresh = q.get("fresh") === "1";
    if (tour === "WTA") return send(res, 200, await wtaPlayers(encodeURIComponent(q.get("id")), encodeURIComponent(q.get("year")), fresh));
    if (tour === "ATP") {
      if (!isDate(q.get("start")) || !isDate(q.get("end"))) return send(res, 400, { error: "start/end required" });
      return send(res, 200, await atpPlayers(q.get("id"), q.get("start"), q.get("end"), fresh));
    }
    return send(res, 400, { error: "tour must be ATP or WTA" });
  }
  if (url.pathname === "/api/hidden") return handleHidden(req, url, res);
  if (url.pathname === "/api/photos") return handlePhotos(req, res);
  send(res, 404, { error: "Not found" });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    try {
      if (url.pathname.startsWith("/api/")) return await handleApi(req, url, res);
      if (url.pathname.startsWith("/photos/")) {
        const photo = path.normalize(path.join(photos.DIR, url.pathname.slice("/photos/".length)));
        if (!photo.startsWith(photos.DIR + path.sep)) return send(res, 403, "Forbidden", "text/plain");
        return fs.readFile(photo, (err, buf) => {
          if (err) return send(res, 404, "Not found", "text/plain");
          res.writeHead(200, { "Content-Type": MIME[path.extname(photo)] || "application/octet-stream", "Cache-Control": "max-age=86400" });
          res.end(buf);
        });
      }
      const file = path.normalize(path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname));
      if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, "Forbidden", "text/plain");
      fs.readFile(file, (err, buf) =>
        err ? send(res, 404, "Not found", "text/plain") : send(res, 200, buf, MIME[path.extname(file)] || "application/octet-stream")
      );
    } catch (err) {
      send(res, 502, { error: err.message });
    }
  })
  .listen(PORT, () => console.log(`Tennis tracker running at http://localhost:${PORT}`));
