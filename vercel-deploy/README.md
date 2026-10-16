# tennis-tournament (Vercel)

**Live:** https://vercel-deploy-nine-umber.vercel.app · **Version:** 1.1.0 ([changelog](../CHANGELOG.md))

Vercel version of the tournament tracker in the repo root. Same frontend and data sources; the Node server is replaced by two serverless functions.

```
public/index.html     frontend (copy of ../public/index.html)
api/tournaments.js    GET /api/tournaments?from=YYYY-MM-DD&to=YYYY-MM-DD[&tour=ATP,WTA]
api/players.js        GET /api/players?tour=WTA&id=&year=  |  ?tour=ATP&id=&start=&end=
lib/tennis.js         WTA (api.wtatennis.com) and ATP (ESPN) fetchers
```

Responses are cached at Vercel's edge for 10 minutes (`s-maxage=600`).

## Deploy

```sh
cd vercel-deploy
vercel          # preview
vercel --prod   # production
```

Local dev: `vercel dev`.
