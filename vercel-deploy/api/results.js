const { wtaResults, atpResults, isDate } = require("../lib/tennis");

// A tournament's singles and doubles finals, for the champions shown on completed tournaments.
module.exports = async (req, res) => {
  const { id, year, start, end } = req.query;
  const tour = String(req.query.tour || "").toUpperCase();
  try {
    let data;
    if (tour === "WTA") {
      data = await wtaResults(encodeURIComponent(id), encodeURIComponent(year));
    } else if (tour === "ATP") {
      if (!isDate(start) || !isDate(end)) return res.status(400).json({ error: "start/end required" });
      data = await atpResults(String(id), start, end);
    } else {
      return res.status(400).json({ error: "tour must be ATP or WTA" });
    }
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
