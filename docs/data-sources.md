# Data sources

The site combines two feeds, one per tour. The fetching code is in `server.js` (local) and `vercel-deploy/lib/tennis.js` (Vercel).

Neither feed is a documented public API. Either could change its format or start blocking requests without warning.

## WTA: WTA's own API

**Base URL:** `https://api.wtatennis.com/tennis/tournaments`

This is the API that wtatennis.com's own pages load their data from, for example https://www.wtatennis.com/tournaments/1023/guangzhou/2026/draws.

### Calendar

`GET /?page=0&pageSize=100&excludeLevels=ITF&from=YYYY-MM-DD&to=YYYY-MM-DD`

| Field used | Example |
|------------|---------|
| Name (`title`, before " - ") | Guangzhou Open |
| Level | WTA 250 |
| City, country | Guangzhou, CHN |
| Surface, indoor/outdoor | Hard (outdoor) |
| Start and end dates | 2026-10-26 to 2026-11-01 |
| Prize money | USD 283,347 |
| Singles draw size | 32 |

ITF events are excluded. Results are paged; the code requests up to 100 per page.

### Players

`GET /{id}/{year}/players`, for example `/1023/2026/players` for Guangzhou.

This is the **entry list**, published before the draw. Each player has a name, country code and seed, plus an entry type: `M` (main draw) or `Q` (qualifying). Singles are event `LS` and doubles are `LD`.

### Results

`GET /{id}/{year}/matches`, for example `/1075/2026/matches` for Wuhan.

Every match of the tournament. The site uses the main-draw finals (`DrawLevelType` `M`, `RoundID` `F`), singles (`DrawMatchType` `S`) and doubles (`D`), to show the champions of completed tournaments.

- `Winner` gives the winning side: `2`, `4` or `6` for side A (won, opponent retired, walkover) and `3`, `5` or `7` for side B.
- `ScoreString` is from the winner's side, for example `7-6(6),0-1 Ret'd`. A deciding match tiebreak is written as a set, `1-0(5)`; the site shows it as `[10-5]`. A walkover is ` W/O`.

### Notes

- The draws page on wtatennis.com showed no player names before the draw ("Draw Currently Not Available"); the API's entry list did.
- The API refuses requests made directly from a browser on another site (it returns 403 when the request comes from another origin). The site therefore fetches it through its own server, `server.js` locally or the Vercel functions when deployed.

## ATP: ESPN's tennis feed

**URL:** `https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=YYYYMMDD-YYYYMMDD`

atptour.com is behind Cloudflare bot protection: every request, including to its API endpoints, gets a "Just a moment..." challenge page instead of data. ESPN's feed is used instead.

### Calendar

The same request with a date range returns every ATP event in it. Fields used: name, venue (split into city and country), start and end dates, and ESPN's event link.

ESPN gives dates as midnight US Eastern time in UTC. For example, an end time of `2026-10-19T03:59Z` means the tournament finishes on Oct 18. The code shifts the end time back six hours before taking the date.

### Players

The code requests the tournament's date range, finds the event by ID (for example `315-2026` for Shanghai), and collects every named competitor from its matches, singles and doubles, including qualifying. Each player has a name, country and, where ESPN gives one, a seed.

Combined events (Grand Slams, Indian Wells, Miami, Madrid, Rome, Cincinnati, Beijing…) also carry the `Women's Singles`, `Women's Doubles` and `Mixed Doubles` groupings. Those are skipped: women come from the WTA feed, and mixed doubles isn't shown.

### Results

The same scoreboard request gives each match's round. The site uses the `Final` competition of the men's singles and men's doubles groupings, skipping the women's and mixed doubles groupings of combined events. The winning competitor has `winner: true`, each set is a `linescores` entry with `tiebreak` points where played, and the status is `STATUS_FINAL`, `STATUS_RETIRED` or `STATUS_WALKOVER`.

### Level, surface and draw size: the ATP's calendar PDFs

ESPN only flags Grand Slams (`major: true`). Each tournament's level (ATP 250, ATP 500, ATP Masters 1000, Grand Slam, ATP Finals, Next Gen ATP Finals), surface and singles draw size come from the ATP's official season calendars, published as PDFs on atptour.com:

| Season | Calendar PDF |
|--------|--------------|
| 2025 | [2025-atp-tour-calendar-25-november-2024.pdf](https://www.atptour.com/-/media/files/calendar-pdfs/2024/2025-atp-tour-calendar-25-november-2024.pdf) |
| 2026 | [2026-atp-tour-calendar-december-2025.pdf](https://www.atptour.com/-/media/files/calendar-pdfs/2025/2026-atp-tour-calendar-december-2025.pdf) |
| 2027 | [2027-atp-tour-calendar-14-january-2026-updated.pdf](https://www.atptour.com/-/media/files/calendar-pdfs/2026/2027-atp-tour-calendar-14-january-2026-updated.pdf) |

They're transcribed by hand into `vercel-deploy/data/atp-calendar.json`, one entry per tournament: start and end dates, city, country, level, name, surface (`H` Hard, `CL` Clay, `G` Grass, `IH` Hard (Indoor)) and draw size. The end date is worked out from the PDF's week columns and its footnotes (Saturday final, Tuesday final and so on). Team events (United Cup, Davis Cup, Laver Cup) and tournaments still listed as TBD are left out.

Each entry carries ESPN's tournament number, the part of the event id before the year (`10` in `10-2026` for Vienna), which is how ESPN events are matched to it. A season without a calendar uses the nearest season's entry for the same number.

**Next season:** tournaments in the calendar that ESPN doesn't list yet, such as all of 2027 as of October 2026, are shown from the calendar alone, under the id ESPN will use (`970-2027` for Brisbane), with the calendar PDF as their link. Their player lists stay empty until ESPN publishes the event.

**Differences from ESPN:**
- The 2025 PDF lists Belgrade in November; the event moved to Athens (Hellenic Championship, ESPN `1039`).
- ESPN lists 2026 Lyon twice, as `110` (Marseille's old number) and `452`. Both match the Lyon entry.
- For tournaments ESPN lists, the dates stay ESPN's, which include qualifying.

**Maintenance:** the ATP posts a revised PDF when the calendar changes. Update the season's entries in `atp-calendar.json` and the table above. The file is `/-/media/files/calendar-pdfs/{year it was published}/{season}-atp-tour-calendar-{date}.pdf`; atptour.com blocks scripted downloads, so open it in a browser.

### What ESPN doesn't provide

- **Pre-draw entry list:** players appear only once the draw is made. Until then, matches list "TBD" and the site shows "No player list published yet."
- **Prize money:** not shown for ATP tournaments.

### Possible alternative

The ATP posts entry lists and draws as PDFs on protennislive.com, for example `https://www.protennislive.com/posting/2026/{id}/mds.pdf`. These would give pre-draw ATP entry lists, but as of October 2026 protennislive.com is behind the same Cloudflare challenge as atptour.com. Wikipedia's tournament pages, another possible source, usually don't exist before the draw either. So the player tracker shows ATP players on a tournament only from the draw, with likely tournaments marked "not confirmed" until then.

## Player photos

| Tour | First choice | Fallback |
|------|--------------|----------|
| WTA | Official headshot: `https://api.wtatennis.com/content/wta/photo/en/?tagNames=player-headshot&referenceExpression=TENNIS_PLAYER:{id} or …` (several players per request; a head crop is preferred, then the newest) | Wikipedia |
| ATP | ESPN headshot: `https://a.espncdn.com/i/headshots/tennis/players/full/{espnId}.png`, which exists for only about 10% of players | Wikipedia |

**Wikipedia fallback:** `https://en.wikipedia.org/api/rest_v1/page/summary/{Name}` gives the article's lead image.
- It's used only when the article's description mentions tennis and the player's birth year. The birth year comes from `api.wtatennis.com/tennis/players/{id}` or `sports.core.api.espn.com/v2/sports/tennis/leagues/atp/athletes/{id}`. This filters out namesakes, for example the 1972-born Martin Damm instead of the 2003-born player.
- The author and license come from the Wikimedia Commons API (`prop=imageinfo&iiprop=extmetadata`) and are shown as the photo's credit.
- Images stored on English Wikipedia rather than Commons are usually non-free. They're kept for the local site only, never published.

The local site saves copies in `photos/`. The live site lists only the original addresses (`vercel-deploy/data/photos.json`), and browsers load the images from WTA, ESPN or Wikimedia. All three serve images to other websites. Wikipedia asks for a descriptive User-Agent and rate-limits fast clients, so lookups run one at a time with a short pause.

## Caching

Both servers keep upstream responses for 10 minutes: in memory in `server.js`, and at Vercel's edge (`s-maxage=600`) when deployed.

Player lists change as players withdraw, so `/api/players` accepts `fresh=1`, which fetches from the source instead of the cached copy (and isn't cached at the edge). The site sends it when you click Update or when an open list reloads by itself (hourly), and the daily email check (`vercel-deploy/lib/alerts.js`) always fetches fresh.
