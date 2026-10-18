// Data fetchers shared by the Vercel API routes: WTA from api.wtatennis.com,
// ATP from ESPN's public tennis feed (atptour.com blocks automated requests).
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const CACHE_TTL_MS = 10 * 60 * 1000;

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

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

// Tournaments removed by hand (data/hidden.json). An entry matches on tour and id; ATP ids can be
// given with or without the year suffix ("10" or "10-2026"). An entry without a year hides every year.
const HIDDEN = require("../data/hidden.json").tournaments || [];
function isHidden(t, hidden = HIDDEN) {
  return hidden.some((h) =>
    String(h.tour).toUpperCase() === t.tour &&
    (String(h.id) === String(t.id) || String(h.id) === String(t.id).split("-")[0]) &&
    (h.year == null || Number(h.year) === Number(t.year)));
}

module.exports = { wtaTournaments, wtaPlayers, atpTournaments, atpPlayers, isDate, isHidden };
