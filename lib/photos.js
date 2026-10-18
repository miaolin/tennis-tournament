// Player photos for the local site. Each player's photo is looked up once, downloaded into photos/
// (not committed) and served from there by server.js.
//   WTA: the official WTA headshot, looked up by WTA player id.
//   ATP: ESPN's headshot when ESPN has one (few players), looked up by ESPN athlete id.
//   Either tour, when the above has none: the lead image of the player's English Wikipedia article,
//   accepted only if the article describes a tennis player born in the player's birth year (so a
//   namesake's photo isn't used).
// Players without a photo are remembered too, and looked up again after RETRY_DAYS.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "photos");
const INDEX_FILE = path.join(DIR, "index.json");
const RETRY_DAYS = 30;
const UA = "tennis-tournament local app (https://github.com/miaolin/tennis-tournament)";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

// The index is re-read before use and merged on save, because the local server and npm run fetch-photos
// can both be adding photos at the same time.
let index = {};
const readIndex = () => { try { return JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")); } catch { return {}; } };
const loadIndex = () => (index = { ...index, ...readIndex() });
const saveIndex = (key, entry) => {
  fs.mkdirSync(DIR, { recursive: true });
  index = { ...index, ...readIndex(), [key]: entry };
  const tmp = `${INDEX_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index, null, 1));
  fs.renameSync(tmp, INDEX_FILE); // atomic, so a reader never sees a half-written file
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const photoKey = (tour, id) => `${tour}-${id}`;
const known = (e) => e && (e.file || Date.now() - e.at < RETRY_DAYS * 864e5);

async function getJSON(url, ua = BROWSER_UA) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "application/json" } });
    if (res.status === 429) { await sleep(2000 * (attempt + 1)); continue; } // rate limited: wait and retry
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    return res.json();
  }
  throw new Error(`Rate limited: ${url}`);
}

async function download(url, key) {
  const res = await fetch(url, { headers: { "User-Agent": url.includes("wikimedia") ? UA : BROWSER_UA } });
  if (!res.ok || !/^image\//.test(res.headers.get("content-type") || "")) return null;
  const ext = { "image/png": ".png", "image/webp": ".webp" }[res.headers.get("content-type")] || ".jpg";
  const file = key + ext;
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, file), Buffer.from(await res.arrayBuffer()));
  return file;
}

// WTA headshots for several players in one request. A player has several photos; prefer a head crop,
// then the most recent. Returns { id: imageUrl }.
async function wtaHeadshots(ids) {
  const expr = ids.map((id) => `TENNIS_PLAYER:${id}`).join(" or ");
  const data = await getJSON(`https://api.wtatennis.com/content/wta/photo/en/?tagNames=player-headshot&pageSize=100&referenceExpression=${encodeURIComponent(expr)}`);
  const best = {};
  const score = (c) => (c.tags.some((t) => t.label === "head-cropped-photo") || /crop/i.test(c.title) ? 1 : 0);
  for (const c of (data && data.content) || []) {
    for (const r of c.references.filter((r) => r.type === "TENNIS_PLAYER" && ids.includes(String(r.id)))) {
      const cur = best[r.id];
      if (!cur || score(c) > score(cur) || (score(c) === score(cur) && c.date > cur.date)) best[r.id] = c;
    }
  }
  return Object.fromEntries(Object.entries(best).map(([id, c]) => [id, c.imageUrl]));
}

async function birthYear(tour, id) {
  try {
    if (tour === "WTA") {
      const p = await getJSON(`https://api.wtatennis.com/tennis/players/${id}`);
      return p && p.dateOfBirth ? p.dateOfBirth.slice(0, 4) : null;
    }
    const a = await getJSON(`https://sports.core.api.espn.com/v2/sports/tennis/leagues/atp/athletes/${id}`);
    return a && a.dateOfBirth ? a.dateOfBirth.slice(0, 4) : null;
  } catch { return null; }
}

async function wikipediaPhoto(name, year) {
  const d = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`, UA);
  if (!d || d.type !== "standard" || !d.thumbnail) return null;
  const desc = d.description || "";
  if (!/tennis/i.test(desc) || (year && !desc.includes(year))) return null;
  return d.thumbnail.source;
}

async function espnHeadshot(id) {
  const url = `https://a.espncdn.com/i/headshots/tennis/players/full/${id}.png`;
  const res = await fetch(url, { method: "HEAD" });
  return res.ok && /^image\//.test(res.headers.get("content-type") || "") ? url : null;
}

// players: [{ tour: "WTA"|"ATP", id, name }]. Finds and downloads photos not yet looked up, one player
// at a time (gentle on the sources), and returns { "WTA-314660": "WTA-314660.jpg", ... } for those with one.
let queue = Promise.resolve();
function ensurePhotos(players, onProgress) {
  const run = queue.then(() => fetchMissing(players, onProgress));
  queue = run.catch(() => {});
  return run;
}

async function fetchMissing(players, onProgress = () => {}) {
  loadIndex();
  const unique = [...new Map(players.filter((p) => p.id).map((p) => [photoKey(p.tour, p.id), p])).values()];
  const missing = unique.filter((p) => !known(index[photoKey(p.tour, p.id)]));
  const wta = missing.filter((p) => p.tour === "WTA").map((p) => String(p.id));
  const wtaUrls = {};
  for (let i = 0; i < wta.length; i += 8) {
    try { Object.assign(wtaUrls, await wtaHeadshots(wta.slice(i, i + 8))); } catch (e) { console.warn("WTA photos:", e.message); }
  }
  let done = 0;
  for (const p of missing) {
    const key = photoKey(p.tour, p.id);
    let file = null, source = null;
    try {
      let url = p.tour === "WTA" ? wtaUrls[p.id] : await espnHeadshot(p.id);
      source = url ? (p.tour === "WTA" ? "WTA" : "ESPN") : null;
      if (!url) {
        url = await wikipediaPhoto(p.name, await birthYear(p.tour, p.id));
        source = url ? "Wikipedia" : null;
        await sleep(300); // Wikipedia rate-limits fast clients
      }
      if (url) file = await download(url, key);
    } catch (e) {
      console.warn(`Photo for ${p.name}:`, e.message);
      continue; // not recorded, so it's tried again next time
    }
    saveIndex(key, file ? { file, source, name: p.name, at: Date.now() } : { file: null, name: p.name, at: Date.now() });
    onProgress(++done, missing.length, p.name, !!file);
  }
  return photoMap(unique);
}

function photoMap(players) {
  loadIndex();
  const out = {};
  for (const p of players) {
    const e = index[photoKey(p.tour, p.id)];
    if (e && e.file) out[photoKey(p.tour, p.id)] = e.file;
  }
  return out;
}

// Players of a /api/players result, as ensurePhotos expects them.
const playersOf = (tour, list) =>
  [...list.singles, ...list.doubles].flatMap((e) => (e.ids || []).map((id, i) => ({ tour, id, name: e.names[i] })));

// Players not looked up yet (or due for another try).
const missing = (players) => { loadIndex(); return players.filter((p) => p.id && !known(index[photoKey(p.tour, p.id)])); };

module.exports = { ensurePhotos, photoMap, playersOf, missing, photoKey, DIR };
