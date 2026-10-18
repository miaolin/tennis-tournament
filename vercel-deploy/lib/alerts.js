// Daily player-list check: for every tournament starting within the next DAYS_AHEAD days, fetch the
// player list fresh, compare it with the copy saved on the previous run, save the new copy and email
// the changes (withdrawals, additions, moves between main draw and qualifying).
// Used by api/check-players.js (Vercel cron) and scripts/check-players.js (local run).
const { wtaTournaments, wtaPlayers, atpTournaments, atpPlayers, isHidden } = require("./tennis");

const DAYS_AHEAD = 15;
const KEEP_DAYS = 60; // saved lists expire this long after the last check
const SITE = "https://tennis-tournament-vercel-deploy.vercel.app";
const ENTRY = { M: "Main draw", Q: "Qualifying", WC: "Wildcards", LL: "Lucky losers", ALT: "Alternates", PR: "Protected ranking", SE: "Special exempt" };

const addDays = (day, n) => new Date(Date.parse(day + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// A saved list is { "Singles|Name": "M", "Doubles|Name / Name": "Q", ... }: each entry and its entry type.
function snapshot(p) {
  const out = {};
  for (const e of p.singles) out[`Singles|${e.names.join(" / ")}`] = e.entry || "";
  for (const e of p.doubles) out[`Doubles|${e.names.join(" / ")}`] = e.entry || "";
  return out;
}

function diff(before, after) {
  const ids = (o) => Object.keys(o);
  return {
    removed: ids(before).filter((id) => !(id in after)),
    added: ids(after).filter((id) => !(id in before)),
    moved: ids(after).filter((id) => id in before && before[id] !== after[id]).map((id) => ({ id, from: before[id], to: after[id] })),
  };
}

async function upcoming(today) {
  const to = addDays(today, DAYS_AHEAD);
  const settled = await Promise.allSettled([wtaTournaments(today, to), atpTournaments(today, to)]);
  const errors = settled.filter((s) => s.status === "rejected").map((s) => s.reason.message);
  const tournaments = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []))
    .filter((t) => t.startDate >= today && t.startDate <= to && !isHidden(t))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return { tournaments, errors };
}

// store: { get(key) -> object|null, set(key, object, ttlSeconds) }; send: ({ subject, text, html }) -> Promise.
// test: send an email even when nothing changed (to check the setup).
async function checkPlayers({ store, send, today = new Date().toISOString().slice(0, 10), test = false }) {
  const { tournaments, errors } = await upcoming(today);
  const results = await Promise.all(tournaments.map(async (t) => {
    try {
      const p = t.tour === "WTA" ? await wtaPlayers(t.id, t.year, true) : await atpPlayers(t.id, t.startDate, t.endDate, true);
      const now = snapshot(p);
      const key = `players:${t.tour}:${t.id}:${t.year}`;
      const prev = await store.get(key);
      await store.set(key, now, KEEP_DAYS * 86400);
      // The first check of a tournament only saves its list; changes are reported from the next day on.
      return { t, count: Object.keys(now).length, first: !prev, wasEmpty: !!prev && !Object.keys(prev).length, ...(prev ? diff(prev, now) : {}) };
    } catch (err) {
      errors.push(`${t.tour} ${t.name}: ${err.message}`);
      return null;
    }
  }));
  const checked = results.filter(Boolean);
  const changed = checked.filter((r) => !r.first && r.removed.length + r.added.length + r.moved.length);
  let emailed = false;
  if (changed.length || test) {
    await send(email(changed, checked, errors, today, test));
    emailed = true;
  }
  return {
    today,
    checked: checked.map((r) => `${r.t.tour} ${r.t.name} (${r.t.startDate}): ${r.count} entries${r.first ? ", first check" : ""}`),
    changed: changed.map((r) => ({ tournament: `${r.t.tour} ${r.t.name}`, withdrawn: r.removed, added: r.added, moved: r.moved })),
    emailed,
    errors,
  };
}

function email(changed, checked, errors, today, test) {
  const name = (id) => id.replace("|", ": ");
  const entry = (c) => ENTRY[c] || c || "–";
  const subject = changed.length
    ? `Player list changes: ${changed.map((r) => r.t.name).join(", ")}`
    : "Tennis player alerts: test email (no changes)";
  const text = [], html = [];
  for (const r of changed) {
    const t = r.t, when = `${t.startDate} to ${t.endDate}`;
    text.push(`${t.name} (${t.level || t.tour}, ${[t.city, t.country].filter(Boolean).join(", ")}, ${when})`);
    html.push(`<h3 style="margin:18px 0 4px">${esc(t.name)}</h3><div style="color:#666;font-size:13px">${esc(t.level || t.tour)} · ${esc([t.city, t.country].filter(Boolean).join(", "))} · ${esc(when)}</div>`);
    const section = (label, color, items) => {
      if (!items.length) return;
      text.push(`  ${label} (${items.length}):`, ...items.map((s) => `    - ${s}`));
      html.push(`<p style="margin:8px 0 2px;color:${color}"><b>${esc(label)} (${items.length})</b></p><ul style="margin:0">${items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`);
    };
    // A list that was empty yesterday has just been published (an entry list or ATP draw): summarize it.
    if (r.wasEmpty) {
      text.push(`  Player list published: ${r.added.length} entries`);
      html.push(`<p style="margin:8px 0 2px;color:#2e7d32"><b>Player list published: ${r.added.length} entries</b></p>`);
    } else {
      section("Withdrawn", "#c62828", r.removed.map(name));
      section("Added", "#2e7d32", r.added.map(name));
    }
    section("Moved", "#444", r.moved.map((m) => `${name(m.id)}: ${entry(m.from)} → ${entry(m.to)}`));
    text.push("");
  }
  if (!changed.length) {
    text.push("No player list changes today. This test email confirms alerts are set up.", "");
    html.push("<p>No player list changes today. This test email confirms alerts are set up.</p>");
  }
  const footer = `Checked ${checked.length} tournaments starting between ${today} and ${addDays(today, DAYS_AHEAD)}.`;
  text.push(footer, ...errors.map((e) => `Error: ${e}`), SITE);
  html.push(`<p style="color:#666;font-size:12px;margin-top:20px">${esc(footer)}${errors.map((e) => `<br>Error: ${esc(e)}`).join("")}<br><a href="${SITE}">${SITE}</a></p>`);
  return { subject, text: text.join("\n"), html: `<div style="font-family:system-ui,sans-serif">${html.join("")}</div>` };
}

// ---------------------------------------------------------------- Vercel services (over plain HTTPS, no packages)

// Upstash Redis REST API. Vercel's Upstash integration sets KV_REST_API_URL/KV_REST_API_TOKEN.
function redisStore(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  const cmd = async (args) => {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(`Redis: ${data.error || res.status}`);
    return data.result;
  };
  return {
    get: async (key) => JSON.parse((await cmd(["GET", key])) || "null"),
    set: (key, value, ttl) => cmd(["SET", key, JSON.stringify(value), "EX", String(ttl)]),
  };
}

// Resend email API. Without a verified domain, Resend only delivers from onboarding@resend.dev to the
// email address of the Resend account itself.
function resendSender(env = process.env) {
  return async ({ subject, text, html }) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.ALERT_FROM || "Tennis alerts <onboarding@resend.dev>", to: env.ALERT_EMAIL.split(",").map((s) => s.trim()), subject, text, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  };
}

const missingConfig = (env = process.env) => [
  ["RESEND_API_KEY"], ["ALERT_EMAIL"],
  ["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"], ["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"],
].filter((names) => !names.some((n) => env[n])).map((names) => names.join(" or "));

module.exports = { checkPlayers, redisStore, resendSender, missingConfig, snapshot, diff, DAYS_AHEAD };
