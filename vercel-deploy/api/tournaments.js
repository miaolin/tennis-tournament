const { wtaTournaments, atpTournaments, isDate } = require("../lib/tennis");

module.exports = async (req, res) => {
  const { from, to, tour = "ATP,WTA" } = req.query;
  if (!isDate(from) || !isDate(to)) return res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
  const tours = String(tour).toUpperCase().split(",");
  const jobs = [];
  if (tours.includes("WTA")) jobs.push(wtaTournaments(from, to));
  if (tours.includes("ATP")) jobs.push(atpTournaments(from, to));
  const settled = await Promise.allSettled(jobs);
  const tournaments = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const errors = settled.filter((s) => s.status === "rejected").map((s) => s.reason.message);
  tournaments.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.tour.localeCompare(b.tour));
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
  res.status(200).json({ tournaments, errors });
};
