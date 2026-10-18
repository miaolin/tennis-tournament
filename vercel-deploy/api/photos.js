// Player photos for the live site: POST { players: [{ tour, id }] } returns { photos: { "WTA-314660":
// { src, credit, link } }, pending: 0 } from data/photos.json, which lists each photo's original address
// (WTA, ESPN or Wikimedia Commons). The images themselves are loaded from those hosts, not stored here.
const { photos } = require("../data/photos.json");

module.exports = (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST expected" });
  const players = Array.isArray(req.body && req.body.players) ? req.body.players.slice(0, 600) : [];
  const out = {};
  for (const p of players) {
    const key = `${p.tour}-${p.id}`;
    if (photos[key]) out[key] = photos[key];
  }
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ photos: out, pending: 0 });
};
