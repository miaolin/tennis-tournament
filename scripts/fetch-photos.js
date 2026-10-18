// Downloads player photos ahead of time into photos/, for every tournament in progress or starting
// within the next N days (default 15). The local site also fetches missing photos itself when a player
// list is opened; this just does it in one go.
//   npm run fetch-photos            (or: npm run fetch-photos -- 30   for the next 30 days)
const { wtaTournaments, wtaPlayers, atpTournaments, atpPlayers, isHidden } = require("../vercel-deploy/lib/tennis");
const { ensurePhotos, playersOf } = require("../lib/photos");

const days = Number(process.argv[2]) || 15;
const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

(async () => {
  const from = day(0), to = day(days);
  const tournaments = (await Promise.all([wtaTournaments(day(-14), to), atpTournaments(day(-14), to)])).flat()
    .filter((t) => t.endDate >= from && t.startDate <= to && !isHidden(t));
  const players = [];
  for (const t of tournaments) {
    try {
      const list = t.tour === "WTA" ? await wtaPlayers(t.id, t.year) : await atpPlayers(t.id, t.startDate, t.endDate);
      const ps = playersOf(t.tour, list);
      console.log(`${t.tour} ${t.name}: ${ps.length} players`);
      players.push(...ps);
    } catch (e) {
      console.warn(`${t.tour} ${t.name}: ${e.message}`);
    }
  }
  const found = await ensurePhotos(players, (n, total, name, ok) => console.log(`  [${n}/${total}] ${ok ? "photo" : "none "}  ${name}`));
  const unique = new Set(players.map((p) => `${p.tour}-${p.id}`)).size;
  console.log(`\nPhotos for ${Object.keys(found).length} of ${unique} players, saved in photos/.`);
})().catch((e) => { console.error(e); process.exit(1); });
