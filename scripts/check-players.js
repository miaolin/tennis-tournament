// Runs the daily player-list check on this computer, saving lists to data/player-snapshots.json.
// Emails the changes if RESEND_API_KEY and ALERT_EMAIL are set; otherwise prints the email.
//   npm run check-players              (add -- --test to send/print an email even with no changes)
const fs = require("fs");
const path = require("path");
const { checkPlayers, resendSender } = require("../vercel-deploy/lib/alerts");

const FILE = path.join(__dirname, "..", "data", "player-snapshots.json");

const read = () => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } };
const store = {
  get: async (key) => read()[key] || null,
  set: async (key, value) => {
    const all = read();
    all[key] = value;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(all));
  },
};

const send = process.env.RESEND_API_KEY && process.env.ALERT_EMAIL
  ? resendSender()
  : async ({ subject, text }) => console.log(`--- email (not sent: RESEND_API_KEY / ALERT_EMAIL not set) ---\nSubject: ${subject}\n\n${text}\n---`);

checkPlayers({ store, send, test: process.argv.includes("--test") })
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((err) => { console.error(err); process.exit(1); });
