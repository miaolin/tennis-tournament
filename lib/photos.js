// Player photos. Each player's photo is looked up once, downloaded into photos/ (not committed) and served
// from there by the local server. The live site instead loads each photo from its original address, listed
// in vercel-deploy/data/photos.json by npm run export-photos.
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

// A player's name and birth year, from the WTA player API or ESPN's athlete API.
async function person(tour, id) {
  try {
    const d = tour === "WTA"
      ? await getJSON(`https://api.wtatennis.com/tennis/players/${id}`)
      : await getJSON(`https://sports.core.api.espn.com/v2/sports/tennis/leagues/atp/athletes/${id}`);
    if (!d) return {};
    const name = tour === "WTA" ? d.fullName : d.displayName;
    return { name, year: d.dateOfBirth ? d.dateOfBirth.slice(0, 4) : null };
  } catch { return {}; }
}

async function wikipediaPhoto(name, year) {
  const d = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, "_"))}?redirect=true`, UA);
  if (!d || d.type !== "standard" || !d.thumbnail) return null;
  const desc = d.description || "";
  if (!/tennis/i.test(desc) || (year && !desc.includes(year))) return null;
  return { url: d.thumbnail.source.split("?")[0], page: d.content_urls && d.content_urls.desktop && d.content_urls.desktop.page };
}

// Author and license of a Wikimedia Commons image, for the credit the license asks for. Images stored on
// English Wikipedia itself (not Commons) are usually non-free; they get no credit and are never published.
async function commonsCredit(url) {
  const m = url.match(/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/);
  if (!m) return null;
  const title = `File:${decodeURIComponent(m[1])}`;
  const d = await getJSON(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent(title)}`, UA);
  const page = d && Object.values(d.query.pages)[0];
  const meta = (page && page.imageinfo && page.imageinfo[0].extmetadata) || {};
  const text = (k) => (meta[k] ? String(meta[k].value).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "");
  const author = text("Artist") || "unknown author";
  const license = text("LicenseShortName") || "see file page";
  return { credit: `Photo: ${author}, ${license}, via Wikimedia Commons`, link: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` };
}

async function espnHeadshot(id) {
  const url = `https://a.espncdn.com/i/headshots/tennis/players/full/${id}.png`;
  const res = await fetch(url, { method: "HEAD" });
  return res.ok && /^image\//.test(res.headers.get("content-type") || "") ? url : null;
}

// Where a player's photo comes from: { url, source, credit, link } or null. wtaUrl: the WTA headshot found
// in a batch lookup (WTA players). name may be missing; it's then taken from the WTA or ESPN API.
async function findPhoto(p, wtaUrl) {
  if (p.tour === "WTA" && wtaUrl) return { url: wtaUrl, source: "WTA", credit: "Photo: WTA", link: null };
  if (p.tour === "ATP") {
    const url = await espnHeadshot(p.id);
    if (url) return { url, source: "ESPN", credit: "Photo: ESPN", link: null };
  }
  const who = await person(p.tour, p.id);
  const name = p.name || who.name;
  if (!name) return null;
  const wiki = await wikipediaPhoto(name, who.year);
  await sleep(300); // Wikipedia rate-limits fast clients
  if (!wiki) return null;
  const c = await commonsCredit(wiki.url);
  return { url: wiki.url, source: "Wikipedia", credit: c ? c.credit : "Photo: Wikipedia", link: c ? c.link : wiki.page, commons: !!c };
}

async function wtaBatch(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 8) {
    try { Object.assign(out, await wtaHeadshots(ids.slice(i, i + 8))); } catch (e) { console.warn("WTA photos:", e.message); }
  }
  return out;
}

// players: [{ tour: "WTA"|"ATP", id, name }]. Finds and downloads photos not yet looked up, one player
// at a time (gentle on the sources), and returns photoMap() for them.
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
  const wtaUrls = await wtaBatch(missing.filter((p) => p.tour === "WTA").map((p) => String(p.id)));
  let done = 0;
  for (const p of missing) {
    const key = photoKey(p.tour, p.id);
    let found = null, file = null;
    try {
      found = await findPhoto(p, wtaUrls[p.id]);
      if (found) file = await download(found.url, key);
    } catch (e) {
      console.warn(`Photo for ${p.name}:`, e.message);
      continue; // not recorded, so it's tried again next time
    }
    saveIndex(key, file ? { file, ...found, name: p.name, at: Date.now() } : { file: null, name: p.name, at: Date.now() });
    onProgress(++done, missing.length, p.name, !!file);
  }
  return photoMap(unique);
}

// { key: { src, credit, link } } for the players that have a photo, served from photos/.
function photoMap(players) {
  loadIndex();
  const out = {};
  for (const p of players) {
    const e = index[photoKey(p.tour, p.id)];
    if (e && e.file) out[photoKey(p.tour, p.id)] = { src: `/photos/${encodeURIComponent(e.file)}`, credit: e.credit || null, link: e.link || null };
  }
  return out;
}

// Photos saved before their original address was recorded: look the address up again (no download).
async function backfillUrls(onProgress = () => {}) {
  loadIndex();
  const todo = Object.entries(index).filter(([, e]) => e.file && !e.url).map(([key, e]) => {
    const [tour, id] = key.split("-");
    return { key, tour, id, name: e.name };
  });
  const wtaUrls = await wtaBatch(todo.filter((p) => p.tour === "WTA").map((p) => p.id));
  let done = 0;
  for (const p of todo) {
    let found = null;
    try { found = await findPhoto(p, wtaUrls[p.id]); } catch (e) { console.warn(`Photo for ${p.key}:`, e.message); }
    if (found) saveIndex(p.key, { ...index[p.key], ...found, name: p.name || index[p.key].name });
    onProgress(++done, todo.length, p.name || p.key, !!found);
  }
}

// The photos the live site may show: original addresses only (no image files), and only WTA/ESPN
// headshots or Wikimedia Commons images with their credit. { key: { src, credit, link } }
function publicPhotos() {
  loadIndex();
  const out = {};
  for (const [key, e] of Object.entries(index).sort(([a], [b]) => a.localeCompare(b))) {
    if (!e.file || !e.url || (e.source === "Wikipedia" && !e.commons)) continue;
    out[key] = { src: e.url, credit: e.credit || null, link: e.link || null };
  }
  return out;
}

// Players of a /api/players result, as ensurePhotos expects them.
const playersOf = (tour, list) =>
  [...list.singles, ...list.doubles].flatMap((e) => (e.ids || []).map((id, i) => ({ tour, id, name: e.names[i] })));

// Players not looked up yet (or due for another try).
const missing = (players) => { loadIndex(); return players.filter((p) => p.id && !known(index[photoKey(p.tour, p.id)])); };

module.exports = { ensurePhotos, photoMap, playersOf, missing, photoKey, backfillUrls, publicPhotos, DIR };
