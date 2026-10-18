# tennis-tournament (Vercel)

**Live:** https://tennis-tournament-vercel-deploy.vercel.app · **Version:** 1.3.0 ([changelog](../CHANGELOG.md))

Vercel version of the tournament tracker in the repo root. Same frontend and data sources; the Node server is replaced by serverless functions, plus a daily cron job that emails player list changes.

```
public/index.html     frontend (copy of ../public/index.html)
api/tournaments.js    GET /api/tournaments?from=YYYY-MM-DD&to=YYYY-MM-DD[&tour=ATP,WTA]
api/players.js        GET /api/players?tour=WTA&id=&year=  |  ?tour=ATP&id=&start=&end=
api/photos.js         POST /api/photos: player photo addresses and credits from data/photos.json
api/check-players.js  daily cron job (vercel.json): emails player list changes
lib/tennis.js         WTA (api.wtatennis.com) and ATP (ESPN) fetchers
lib/alerts.js         the daily check: compare with yesterday's lists, email the changes
data/hidden.json      tournaments removed by hand
data/photos.json      player photo addresses and credits (written by npm run export-photos in the repo root)
vercel.json           cron schedule (00:00 UTC = 08:00 in UTC+8)
```

Setting up the email alerts is described in [../README.md](../README.md#daily-email-alerts).

Responses are cached at Vercel's edge for 10 minutes (`s-maxage=600`), except `fresh=1` player lists and photos.

Player photos are not stored here: the browser loads each one from its original host (WTA, ESPN or Wikimedia Commons). See [Player photos](../README.md#player-photos).

Data sources (WTA API and ESPN's ATP feed) are documented in [../docs/data-sources.md](../docs/data-sources.md).

## Deploy

The Vercel project `tennis-tournament-vercel-deploy` is connected to the GitHub repo with this folder as its root, so every push to `main` deploys to production. By hand:

```sh
cd vercel-deploy
vercel          # preview
vercel --prod   # production
```

Local dev: `vercel dev`.
