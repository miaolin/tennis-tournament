# tennis-tournament

A small website that collects ATP and WTA tournament information (dates, venue, level, surface, prize money) and player lists in one place.

## Run

```sh
npm start          # or: node server.js
# open http://localhost:3000  (set PORT=xxxx to change)
```

No dependencies. Requires Node 18+ (uses built-in `fetch`).

## Data sources

| Tour | Calendar | Player list |
|------|----------|-------------|
| WTA  | `api.wtatennis.com/tennis/tournaments` (same API behind wtatennis.com) | `/{id}/{year}/players`: entry list (main draw + qualifying), published before the draw |
| ATP  | ESPN tennis scoreboard (`site.api.espn.com/.../tennis/atp/scoreboard`) | Players from the ESPN draw, available once the draw is made |

atptour.com is behind Cloudflare bot protection, so ATP data comes from ESPN, which doesn't publish pre-draw entry lists, surface or prize money.
The WTA API rejects browser requests from other origins, so `server.js` proxies both sources and caches responses for 10 minutes.
