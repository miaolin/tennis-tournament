# tennis-tournament (Vercel)

**Live:** https://vercel-deploy-nine-umber.vercel.app · **Version:** 1.1.0 ([changelog](../CHANGELOG.md))

Vercel version of the tournament tracker in the repo root. Same frontend and data sources; the Node server is replaced by serverless functions, plus a daily cron job that emails player list changes.

```
public/index.html     frontend (copy of ../public/index.html)
api/tournaments.js    GET /api/tournaments?from=YYYY-MM-DD&to=YYYY-MM-DD[&tour=ATP,WTA]
api/players.js        GET /api/players?tour=WTA&id=&year=  |  ?tour=ATP&id=&start=&end=
api/check-players.js  daily cron job (vercel.json): emails player list changes
lib/tennis.js         WTA (api.wtatennis.com) and ATP (ESPN) fetchers
lib/alerts.js         the daily check: compare with yesterday's lists, email the changes
vercel.json           cron schedule (00:00 UTC = 08:00 in UTC+8)
```

Setting up the email alerts is described in [../README.md](../README.md#daily-email-alerts).

Responses are cached at Vercel's edge for 10 minutes (`s-maxage=600`).

Data sources (WTA API and ESPN's ATP feed) are documented in [../docs/data-sources.md](../docs/data-sources.md).

## Deploy

```sh
cd vercel-deploy
vercel          # preview
vercel --prod   # production
```

Local dev: `vercel dev`.
