# tennis-tournament

A small website that collects ATP and WTA tournament information (dates, venue, level, surface, prize money) and player lists in one place.

**Live:** https://vercel-deploy-nine-umber.vercel.app · **Version:** 1.0.0 ([changelog](CHANGELOG.md))

## Features

- ATP and WTA tournaments on one page, grouped by week, with an "In progress / Upcoming / Completed" status
- Filter by tour (All / ATP / WTA) and date range (defaults to a week ago through 60 days ahead)
- Search by tournament, city or country, plus players in any tournament you've opened
- Click a tournament to load its player list: singles and doubles, grouped into main draw and qualifying, with seeds
- Link to each tournament's official page

## Project layout

```
server.js             Node server: serves public/ and the /api routes (local use)
public/index.html     frontend
vercel-deploy/        serverless version of the same app, deployed to Vercel
CHANGELOG.md          release notes
```

## Run locally

```sh
npm start          # or: node server.js
# open http://localhost:3000  (set PORT=xxxx to change)
```

No dependencies. Requires Node 18+ (uses built-in `fetch`).

## Deploy to Vercel

```sh
cd vercel-deploy
vercel          # preview
vercel --prod   # production
```

See [vercel-deploy/README.md](vercel-deploy/README.md). `vercel-deploy/` keeps its own copies of the frontend and data code, so changes to `public/index.html` or the fetchers in `server.js` need copying to `vercel-deploy/public/` and `vercel-deploy/lib/tennis.js`.

## API

| Route | Parameters | Returns |
|-------|------------|---------|
| `GET /api/tournaments` | `from`, `to` (YYYY-MM-DD), optional `tour=ATP,WTA` | `{ tournaments: [...], errors: [...] }` |
| `GET /api/players` | WTA: `tour=WTA&id&year` · ATP: `tour=ATP&id&start&end` | `{ source, singles: [...], doubles: [...] }` |

## Data sources

| Tour | Calendar | Player list |
|------|----------|-------------|
| WTA  | `api.wtatennis.com/tennis/tournaments` (same API behind wtatennis.com) | `/{id}/{year}/players`: entry list (main draw + qualifying), published before the draw |
| ATP  | ESPN tennis scoreboard (`site.api.espn.com/.../tennis/atp/scoreboard`) | Players from the ESPN draw, available once the draw is made |

atptour.com is behind Cloudflare bot protection, so ATP data comes from ESPN, which doesn't publish pre-draw entry lists, surface, prize money or tournament level.
The WTA API rejects browser requests from other origins, so the server proxies both sources and caches responses for 10 minutes.
