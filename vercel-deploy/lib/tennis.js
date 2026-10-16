// Data fetchers shared by the Vercel API routes: WTA from api.wtatennis.com,
// ATP from ESPN's public tennis feed (atptour.com blocks automated requests).
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map();

async function getJSON(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
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

async function wtaPlayers(id, year) {
  const data = await getJSON(`${WTA_API}/${id}/${year}/players`);
  const events = { singles: [], doubles: [] };
  for (const ev of data.events || []) {
    const key = ev.eventTypeCode === "LS" ? "singles" : ev.eventTypeCode === "LD" ? "doubles" : null;
    if (!key) continue;
    for (const ep of ev.eventPlayers || []) {
      events[key].push({
        names: ep.players.map((p) => titleCase(p.fullName)),
        countries: ep.players.map((p) => p.countryCode),
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
      level: e.major ? "Grand Slam" : null,
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

async function atpPlayers(id, start, end) {
  const data = await getJSON(`${ESPN_ATP}?dates=${ymd(start)}-${ymd(end)}`);
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
        const athletes = comp.athlete ? [comp.athlete] : (comp.roster && comp.roster.athletes) || [];
        const names = athletes.map((a) => a.displayName).filter((n) => n && n !== "TBD");
        if (!names.length) continue;
        const k = names.join("/");
        if (seen[key].has(k)) continue;
        seen[key].add(k);
        result[key].push({
          names,
          countries: athletes.map((a) => (a.flag && a.flag.alt) || null),
          seed: comp.curatedRank && comp.curatedRank.current < 99 ? String(comp.curatedRank.current) : null,
          entry: null,
        });
      }
    }
  }
  return result;
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

module.exports = { wtaTournaments, wtaPlayers, atpTournaments, atpPlayers, isDate };
