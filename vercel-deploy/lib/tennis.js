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

// ESPN doesn't publish ATP levels, surfaces or draw sizes. They come from the ATP's official
// calendar PDFs, transcribed into data/atp-calendar.json (one calendar per season, source link
// included), keyed by ESPN's tournament number: the part of the event id before the year, e.g.
// "10" in "10-2026" for Vienna. A season without a calendar uses the nearest season's entry.
// Update the file when the ATP publishes a new or revised calendar.
const ATP_CALENDAR = require("../data/atp-calendar.json").years;

function atpCalendarEntry(num, year) {
  const years = Object.keys(ATP_CALENDAR).sort((a, b) => Math.abs(a - year) - Math.abs(b - year) || b - a);
  for (const y of years) {
    const t = ATP_CALENDAR[y].tournaments.find((t) => t.espn.includes(+num));
    if (t) return t;
  }
  return null;
}

// Fills in level, surface and draw size from the calendar, and adds the calendar's tournaments
// in [from, to] that ESPN doesn't list (yet), e.g. next season's, under the id ESPN will use.
function withAtpCalendar(list, from, to) {
  for (const t of list) {
    const c = atpCalendarEntry(t.id.split("-")[0], t.year);
    if (!c) continue;
    t.level = t.level || c.level;
    t.surface = c.surface;
    t.drawSize = c.drawSize;
  }
  const listed = new Set(list.map((t) => t.id));
  for (const [year, cal] of Object.entries(ATP_CALENDAR)) {
    for (const c of cal.tournaments) {
      if (c.end < from || c.start > to || c.espn.some((n) => listed.has(`${n}-${year}`))) continue;
      list.push({
        tour: "ATP",
        id: `${c.espn[0]}-${year}`,
        year: +year,
        name: c.name,
        level: c.level,
        city: c.city,
        country: c.country,
        surface: c.surface,
        startDate: c.start,
        endDate: c.end,
        prizeMoney: null,
        drawSize: c.drawSize,
        url: cal.source,
      });
    }
  }
  return list;
}

async function atpTournaments(from, to) {
  const data = await getJSON(`${ESPN_ATP}?dates=${ymd(from)}-${ymd(to)}`);
  return withAtpCalendar((data.events || []).map((e) => {
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
  }), from, to);
}

async function atpPlayers(id, start, end, fresh = false) {
  const data = await getJSON(`${ESPN_ATP}?dates=${ymd(start)}-${ymd(end)}`, fresh);
  const ev = (data.events || []).find((e) => e.id === id);
  const result = { source: "ESPN draw (available once the draw is made)", singles: [], doubles: [] };
  if (!ev) return result;
  const seen = { singles: new Set(), doubles: new Set() };
  for (const g of ev.groupings || []) {
    const label = (g.grouping && g.grouping.displayName) || "";
    // Combined events (Grand Slams, Indian Wells, Beijing…) also carry the women's and mixed draws: not ATP players.
    const key = /women|mixed/i.test(label) ? null : /double/i.test(label) ? "doubles" : /single/i.test(label) ? "singles" : null;
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

// ---------------------------------------------------------------- Results (finals)

// The singles and doubles finals of a tournament: { singles, doubles }, each null until it's played, else
// { winner: [names], loser: [names], score: "2-6 6-4 6-2", note: "ret." | "w/o" | null }. Names are short
// ("M. Chwalinska"), the full name being in `full`. Scores are from the winner's side, tiebreaks as 7-6(5)
// and a deciding match tiebreak as [10-6].
const matchTiebreak = (lost) => `[${Math.max(10, lost + 2)}-${lost}]`;
async function wtaResults(id, year) {
  const data = await getJSON(`${WTA_API}/${id}/${year}/matches`);
  const out = { singles: null, doubles: null };
  for (const m of data.matches || []) {
    if (m.DrawLevelType !== "M" || m.RoundID !== "F" || m.MatchState !== "F") continue;
    const key = m.DrawMatchType === "S" ? "singles" : m.DrawMatchType === "D" ? "doubles" : null;
    // Winner: 2, 4, 6 = side A (won, by retirement, by walkover); 3, 5, 7 = side B.
    const w = Number(m.Winner);
    if (!key || !(w >= 2 && w <= 7)) continue;
    const side = (s) => [["", ""], ["2", "2"]].map(([n]) => [m[`PlayerNameFirst${s}${n}`], m[`PlayerNameLast${s}${n}`]]).filter(([, last]) => last);
    const [win, lose] = w % 2 === 0 ? [side("A"), side("B")] : [side("B"), side("A")];
    const raw = (m.ScoreString || "").trim();
    out[key] = {
      winner: win.map(([first, last]) => `${first ? first[0] + ". " : ""}${last}`),
      loser: lose.map(([first, last]) => `${first ? first[0] + ". " : ""}${last}`),
      full: { winner: win.map((p) => p.join(" ").trim()), loser: lose.map((p) => p.join(" ").trim()) },
      score: /W\/O/i.test(raw) ? "" : raw.replace(/\s*Ret'?d/i, "").split(",")
        .map((set) => set.replace(/^1-0\((\d+)\)$/, (_, lost) => matchTiebreak(+lost))).join(" "),
      note: /W\/O/i.test(raw) ? "w/o" : /Ret/i.test(raw) ? "ret." : null,
    };
  }
  return out;
}

async function atpResults(id, start, end) {
  const data = await getJSON(`${ESPN_ATP}?dates=${ymd(start)}-${ymd(end)}`);
  const ev = (data.events || []).find((e) => e.id === id);
  const out = { singles: null, doubles: null };
  for (const g of (ev && ev.groupings) || []) {
    const label = (g.grouping && g.grouping.displayName) || "";
    // Combined events also carry the women's draws, which the WTA feed covers, and mixed doubles.
    const key = /women|mixed/i.test(label) ? null : /double/i.test(label) ? "doubles" : /single/i.test(label) ? "singles" : null;
    if (!key || out[key]) continue;
    const c = (g.competitions || []).find((c) => c.round && c.round.displayName === "Final");
    const done = c && c.status && c.status.type && c.status.type.completed;
    const win = done && c.competitors.find((x) => x.winner), lose = done && c.competitors.find((x) => !x.winner);
    if (!win || !lose) continue;
    const people = (x) => (x.athlete ? [x.athlete] : (x.roster && x.roster.athletes) || []);
    const status = c.status.type.name;
    out[key] = {
      winner: people(win).map((a) => a.shortName || a.displayName),
      loser: people(lose).map((a) => a.shortName || a.displayName),
      full: { winner: people(win).map((a) => a.displayName), loser: people(lose).map((a) => a.displayName) },
      score: (win.linescores || []).map((s, i) => {
        const l = (lose.linescores || [])[i] || {};
        const tb = s.tiebreak != null && l.tiebreak != null ? Math.min(s.tiebreak, l.tiebreak) : null;
        if (tb != null && s.value === 1 && !l.value) return matchTiebreak(tb);
        return `${s.value}-${l.value ?? 0}${tb != null ? `(${tb})` : ""}`;
      }).join(" "),
      note: status === "STATUS_WALKOVER" ? "w/o" : status === "STATUS_RETIRED" ? "ret." : null,
    };
  }
  return out;
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

module.exports = { wtaTournaments, wtaPlayers, atpTournaments, atpPlayers, wtaResults, atpResults, withAtpCalendar, isDate, isHidden };
