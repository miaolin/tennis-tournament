// Daily player-list check, run by the Vercel cron job in vercel.json. Vercel sends
// "Authorization: Bearer $CRON_SECRET"; any other caller is refused.
// To run it by hand: curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/check-players
// (add ?test=1 to send an email even when nothing changed).
const { checkPlayers, redisStore, resendSender, missingConfig } = require("../lib/alerts");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Unauthorized" });
  const missing = missingConfig();
  if (missing.length) return res.status(500).json({ error: `Missing environment variables: ${missing.join(", ")}` });
  try {
    const result = await checkPlayers({ store: redisStore(), send: resendSender(), test: req.query.test === "1" });
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
