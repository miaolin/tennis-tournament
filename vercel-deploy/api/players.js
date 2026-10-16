const { wtaPlayers, atpPlayers, isDate } = require("../lib/tennis");

module.exports = async (req, res) => {
  const { id, year, start, end } = req.query;
  const tour = String(req.query.tour || "").toUpperCase();
  try {
    let data;
    if (tour === "WTA") {
      data = await wtaPlayers(encodeURIComponent(id), encodeURIComponent(year));
    } else if (tour === "ATP") {
      if (!isDate(start) || !isDate(end)) return res.status(400).json({ error: "start/end required" });
      data = await atpPlayers(String(id), start, end);
    } else {
      return res.status(400).json({ error: "tour must be ATP or WTA" });
    }
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
    res.status(200).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
