# tennis-tournament

A small website that collects ATP and WTA tournament information (dates, venue, level, surface, prize money) and player lists in one place.

**Live:** https://tennis-tournament-vercel-deploy.vercel.app · **Version:** 1.2.0 ([changelog](CHANGELOG.md))

## Features

- ATP and WTA tournaments on one page, grouped by month, with an "In progress / Upcoming / Completed" status
- List view or calendar view (month grids with each tournament as a bar across its dates)
- Filter by tour (ALL / ATP / WTA tiles with counts), tournament type (icon tiles with counts: Grand Slam, 1000, 500, 250, 125, Finals), month, and year (‹ 2026 › switcher)
- Month tiles to pick a month (or All) of the selected year; opens on the current month, with earlier months shown as the archive
- Search by tournament, city or country, plus players in any tournament you've opened
- Click a tournament to load its player list: singles and doubles, grouped into main draw and qualifying, with seeds
- Keep player lists current: **Update** reloads a list from the source, an open list reloads by itself every hour (until the tournament ends), and a summary shows who withdrew, was added or moved since you first opened it
- In-app player alerts: while the site is open, it checks every tournament starting within 15 days once an hour and shows any player list change under **🔔 Alerts**: each player as a colored chip (withdrawn, added, moved), with a New / Read label per alert, a count of new ones, a notice, and an optional desktop notification. Kept in your browser only
- Daily email alert when a player list changes for any tournament starting within 15 days (see [Daily email alerts](#daily-email-alerts))
- Player photos in the player lists, with credits (see [Player photos](#player-photos))
- Link to each tournament's official page

## Project layout

```
server.js             Node server: serves public/ and the /api routes (local use)
public/index.html     frontend
vercel-deploy/        serverless version of the same app, deployed to Vercel
vercel-deploy/data/hidden.json  tournaments removed by hand (see below)
scripts/check-players.js  run the daily player check on this computer
scripts/fetch-photos.js   download player photos ahead of time
scripts/export-photos.js  publish the photo addresses for the live site
lib/photos.js         finds and saves player photos
photos/               saved player photos (not committed)
vercel-deploy/data/photos.json  photo addresses and credits used by the live site
docs/data-sources.md  where the WTA and ATP data comes from
CHANGELOG.md          release notes
```

## Run locally

```sh
npm start          # or: node server.js
# open http://localhost:3000  (set PORT=xxxx to change)
```

No dependencies. Requires Node 18+ (uses built-in `fetch`).

## Deploy to Vercel

The Vercel project `tennis-tournament-vercel-deploy` is connected to this GitHub repo with `vercel-deploy/` as its root directory, so every push to `main` deploys to production and other branches get preview deployments. To deploy by hand:

```sh
cd vercel-deploy
vercel          # preview
vercel --prod   # production
```

See [vercel-deploy/README.md](vercel-deploy/README.md). `vercel-deploy/` keeps its own copies of the frontend and data code, so changes to `public/index.html` or the fetchers in `server.js` need copying to `vercel-deploy/public/` and `vercel-deploy/lib/tennis.js`.

## Removing wrong tournaments

If a tournament's information is wrong, you can remove it for everyone. Removed tournaments are listed in `vercel-deploy/data/hidden.json`, one file used by both the local server and the Vercel deployment.

**From the local site (easiest):** run `npm start`, open the tournament's details and click **Delete**, then click again to confirm. An Undo notice appears for a few seconds. **Hidden (n)** in the filter bar lists everything deleted, with a Restore button for each. The local server writes these changes to `hidden.json`. It only accepts them from your own computer, and the live site doesn't show these buttons.

**By hand:** edit the file directly:

```json
{
  "tournaments": [
    { "tour": "WTA", "id": "1023", "year": 2026, "note": "wrong dates" },
    { "tour": "ATP", "id": "10", "note": "hide every year" }
  ]
}
```

- `tour` and `id`: shown as "ID WTA 1023 · 2026" in the tournament's details on the site. ATP ids can be written with or without the year (`10` or `10-2026`).
- `year` (optional): leave it out to hide the tournament in every year.
- `note` (optional): why it's hidden.

The local server applies changes on the next page reload. To publish them to the live site, commit `hidden.json` and redeploy (`cd vercel-deploy && vercel --prod`).

## Player photos

Each player in a player list is shown with a round photo, or their initials when there's none. Hovering a photo shows its credit; a Wikimedia Commons photo links to its file page with the author and license.

- **WTA players:** the official WTA headshot, matched by WTA player id.
- **ATP players:** ESPN's headshot when ESPN has one (only a few players), matched by ESPN athlete id.
- **Otherwise:** the photo from the player's English Wikipedia article. It's only used if the article describes a tennis player born in the same year as the source says, so a namesake's photo isn't used.

**Local site:** the first time a list is opened, the local server looks up and downloads its players' photos into `photos/`, and they appear as they arrive. After that they load from that folder. Players without a photo are looked up again after 30 days. `photos/index.json` records each photo's source, original address and credit.

**Live site:** the image files aren't published, because WTA and ESPN photos are theirs. Instead, `vercel-deploy/data/photos.json` lists each photo's original address and credit, and the browser loads the photo from WTA, ESPN or Wikimedia Commons directly. Wikipedia images that are not on Commons are usually not freely licensed, so they're left out of the live list.

To update the photos, download them for every tournament in progress or starting within the next 15 days, then publish the list:

```sh
npm run fetch-photos          # or: npm run fetch-photos -- 30   for the next 30 days
npm run export-photos         # writes vercel-deploy/data/photos.json; commit it and push
```

## Daily email alerts

Once a day a Vercel cron job (`vercel-deploy/api/check-players.js`, scheduled in `vercel-deploy/vercel.json` for 00:00 UTC, which is 08:00 in UTC+8) checks every ATP and WTA tournament starting within the next 15 days. It reloads each player list from the source, compares it with the list saved the day before, and emails you the changes: players withdrawn, added, or moved (for example from qualifying to the main draw), and lists published for the first time. No changes, no email. A tournament's first check only saves its list.

**Status:** set up and running on the live site since 2026-10-18 (a test email was received).

The job uses two free services, which need accounts you create yourself:

1. **Resend** (sends the email): sign up at https://resend.com with the address that should receive the alerts, then create an API key. Without your own verified domain, Resend only delivers to the address of your Resend account.
2. **Upstash Redis** (remembers yesterday's lists): in the Vercel dashboard, open the `tennis-tournament-vercel-deploy` project, then **Storage** › **Create Database** › **Upstash for Redis** (free plan), and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` to the project (with a prefix, such as `tennis_tournament_KV_REST_API_URL`, if you chose one; either works).

Then add the other settings and redeploy:

```sh
cd vercel-deploy
vercel env add RESEND_API_KEY production   # paste the Resend API key
vercel env add ALERT_EMAIL production      # your Resend account's email (comma-separate several)
openssl rand -hex 32 | vercel env add CRON_SECRET production   # Vercel sends this with each cron call
vercel --prod
```

Optional: `ALERT_FROM` sets the sender (default `Tennis alerts <onboarding@resend.dev>`; your own needs a domain verified in Resend).

To check the setup, call the job by hand with `?test=1`, which emails you even when nothing changed. Vercel stores `CRON_SECRET` encrypted and `vercel env pull` can't read it back, so this replaces the secret with a new one, redeploys so the new value takes effect, and calls the job with it, all in one line. Run it in a terminal from `vercel-deploy/` (in Claude Code, prefix it with `!`):

```sh
S=$(openssl rand -hex 32) && vercel env rm CRON_SECRET production --yes && printf %s "$S" | vercel env add CRON_SECRET production && vercel deploy --prod --yes >/dev/null && curl -s -H "Authorization: Bearer $S" "https://tennis-tournament-vercel-deploy.vercel.app/api/check-players?test=1"
```

It prints the tournaments checked and `"emailed": true`, and the test email arrives within a minute. Any other caller gets 401. Changed settings only apply after a new deployment.

The alerts come from `onboarding@resend.dev`, so the first ones may land in spam; mark them "Not spam". **Locally**, `npm run check-players` runs the same check, saving lists in `data/player-snapshots.json`. It emails if `RESEND_API_KEY` and `ALERT_EMAIL` are set in the environment; otherwise it prints the email. Add `-- --test` to get an email even with no changes.

## API

| Route | Parameters | Returns |
|-------|------------|---------|
| `GET /api/tournaments` | `from`, `to` (YYYY-MM-DD), optional `tour=ATP,WTA` | `{ tournaments: [...], errors: [...] }` |
| `GET /api/players` | WTA: `tour=WTA&id&year` · ATP: `tour=ATP&id&start&end` · optional `fresh=1` to skip the cache | `{ source, singles: [...], doubles: [...] }`; each entry has `names`, `countries`, `ids` (WTA or ESPN player ids), `seed`, `entry` |
| `POST /api/photos` | JSON `{ players: [{ tour, id, name }] }` | `{ photos: { "WTA-314660": { src, credit, link } }, pending }`. Local: saved copies, looks up missing ones in the background (`pending` until done; same computer only). Live: original addresses from `vercel-deploy/data/photos.json`, `pending` always 0 |
| `GET /api/check-players` | live site only, `Authorization: Bearer $CRON_SECRET`, optional `test=1` | the daily email check's result |

## Data sources

| Tour | Calendar | Player list |
|------|----------|-------------|
| WTA  | `api.wtatennis.com/tennis/tournaments` (same API behind wtatennis.com) | `/{id}/{year}/players`: entry list (main draw + qualifying), published before the draw |
| ATP  | ESPN tennis scoreboard (`site.api.espn.com/.../tennis/atp/scoreboard`) | Players from the ESPN draw, available once the draw is made |

atptour.com is behind Cloudflare bot protection, so ATP data comes from ESPN, which doesn't publish pre-draw entry lists, surface, prize money or tournament level. ATP levels come from a hand-maintained table in the server code.
The WTA API rejects browser requests from other origins, so the server proxies both sources and caches responses for 10 minutes.

Full details (endpoints, fields used, date handling, limitations): [docs/data-sources.md](docs/data-sources.md).
