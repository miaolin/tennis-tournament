# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Player tracker: a new **★ Players** tab, next to List and Calendar, to follow players and see their season.
  - A dropdown of every player in this year's lists (with country, tour and number of tournaments): type to narrow it down, and click a player (or use the arrow keys and Enter) to follow or unfollow them. The ☆ next to each name in a player list does the same.
  - Each followed player's year is drawn as a chain of tournaments from left to right: one stop per tournament (its tile, dates, singles or doubles, draw, seed and doubles partner), joined by a solid line up to a **Today** marker and a dashed one after. Each stop is marked Played, 🏆 Champion, Final, Playing now or Upcoming, and the chain opens scrolled to today. Clicking a stop opens the tournament.
  - Above each chain: tournaments played, titles, tournaments to come, and the one they're playing now or next.
  - Upcoming tournaments appear once their player list is published.
  - Tournament cards show ★ with the followed players entered, and their rows in player lists are highlighted. In alerts, followed players' chips are starred and outlined in gold, and the notice names them.
  - The first load reads all of the year's player lists (about half a minute). Finished tournaments' lists are then kept in your browser, and the rest are reloaded once an hour while the site is open. Followed players are kept in your browser only.

### Fixed

- ATP player lists of combined events (Grand Slams, Indian Wells, Miami, Madrid, Rome, Cincinnati, Beijing…) included the women's singles, women's doubles and mixed doubles players. They now list the men's draws only.
- The doubles champion of an ATP combined event could be the mixed doubles winners (the 2026 US Open showed Muchová / Menšík). Champions already saved in the browser are loaded again.

### Changed

- Withdrawn players in alerts are no longer struck through, so their names are easier to read. The red chip and − sign still mark them.

## [1.4.0] - 2026-10-21

### Added

- Completed tournaments show their champions: one line each for the singles and doubles finals, with the runner-up and the score (retirements and walkovers noted). Hovering shows full names. Results load in the background, from the WTA feed for WTA events and ESPN for ATP events (new `/api/results`), and are kept in the browser since a final never changes.
- The list view jumps to the first in-progress tournament, past the completed ones: when the site opens and when you choose a month (or All), a tour or a type.
- Each alert has a Dismiss ✕ link that removes just that alert, so it no longer shows. Clear all still removes every alert.

### Changed

- Alerts are easier to read. Each alert has a Show players / Hide link next to its counts, so it no longer unfolds only through its title. Opening an alert shows its changes (withdrawn, added, moved) above the tournament's player list, and its added players are tagged New.

### Fixed

- An alert's players use the whole row. The column with New, Open and Dismiss was taking half the width, so the names wrapped after two.

## [1.3.0] - 2026-10-18

### Added

- Player photos in the player lists, shown in round frames, with initials when there's no photo. Hovering shows the credit, and Wikimedia Commons photos link to their file page.
  - Sources: official WTA headshots for WTA players, ESPN headshots for ATP players where ESPN has them, and otherwise the player's Wikipedia photo, checked against their birth year.
  - The local site downloads each photo once into `photos/`, which isn't committed. `npm run fetch-photos` downloads them ahead of time.
  - The live site loads each photo from its original host (WTA, ESPN or Wikimedia Commons) using the addresses in `vercel-deploy/data/photos.json`, which `npm run export-photos` writes (445 players so far). No image files are published.
  - Player lists now include each player's WTA or ESPN id.

- In-app player alerts. While the site is open, even in a background tab, it checks the player lists of every tournament starting within 15 days once an hour. It compares them with the lists saved in this browser at the previous check, and records each change as an alert: players withdrawn, added or moved, or a list newly published.
  - New alerts show as a notice, and the 🔔 Alerts button gives a count of new ones.
  - Each alert has a New / Read label, which you can click to switch. Opening an alert marks it read, and there's a Mark all read button. Unread alerts have a green edge; read ones are dimmed.
  - Alerts fold and unfold by clicking their title. A folded alert shows one line of counts (for example "−1 withdrawn · +2 added · 1 moved"). New alerts start unfolded and read ones folded, unless you fold or unfold them yourself. The list has a Close button, and the 🔔 Alerts button also opens and closes it.
  - The differences are shown as one chip per player: withdrawn in red and struck through, added in green with +, moved in amber (for example "Qualifying → Main draw").
  - The Alerts list has an Open button that jumps to the tournament, plus Check now, Clear all, and an option to turn on desktop notifications.
  - Alerts and saved lists stay in your browser. The first check of each tournament only saves its list. The daily email is separate and unchanged.

- `POST /api/photos` on both servers. The local one returns saved photos and looks up missing ones; the live one returns the published addresses.

### Changed

- Player lists no longer have an Auto-update switch. Instead, an open list reloads by itself once it's an hour old, and so does a list you reopen after an hour. Tournaments that have finished aren't reloaded. Previously Auto-update reloaded every 5 minutes, and lists reopened after 10 minutes reloaded. The Update button still reloads at any time, and the daily email check is unchanged.
- Docs:
  - README: the email alerts section now says they're live, gives a one-line test that works with Vercel's encrypted `CRON_SECRET`, and notes that the first alerts may land in spam. It also has a Player photos section and lists `/api/photos` in the API table.
  - docs/data-sources.md: describes where photos come from.
  - vercel-deploy/README: covers the photo route, the data files and the GitHub auto-deploy.

### Fixed

- Daily email alerts didn't find the Upstash Redis settings when the store was connected with a name prefix (for example `tennis_tournament_KV_REST_API_URL`). Prefixed and unprefixed names now both work.

## [1.2.0] - 2026-10-18

### Added

- ATP tournament levels (ATP 250 / 500 / Masters 1000, ATP Finals, Next Gen ATP Finals). ESPN doesn't provide them, so they come from a hand-maintained table in the server code, keyed by ESPN's tournament number.
- Removing wrong tournaments by hand: tournaments listed in `vercel-deploy/data/hidden.json` are dropped by the server for every visitor. Each tournament's details now show its ID for use in that file. On the local site, a Delete button (click twice to confirm, with Undo) and a Hidden (n) list with Restore edit the file for you; the server only accepts these changes from the same computer, and the live site doesn't show the buttons.
- Month selector as a row of month tiles (All, then each month with its tournament count), set to the current month when the site opens. Earlier months are the archive: dimmed, set apart by a divider, and labeled Archive in their heading. The current month has a "now" dot. Each tournament belongs to the month it starts in, so one spanning two months (for example Sep 28 – Oct 4) appears only once, under September; one that started the previous December goes under January.
- Tournament type selector as large icon tiles, each with a count: All types (grid icon), Grand Slam (trophy), 1000 / 500 / 250 / 125 (the number in its level color), Finals (star). They follow the tour tab: ATP has no 125 tile and its 1000 tile is captioned ATP Masters; under All, 1000 covers WTA 1000 and ATP Masters 1000.
- Updating player lists, since players withdraw or get in from the alternates list: each tournament's details have an Update button that reloads the list straight from the source (skipping the 10-minute cache), and an Auto-update switch that reloads it every 5 minutes while it's open (remembered per browser). A list reopened after 10 minutes reloads by itself. The details show when the list was last updated and what changed since it was first loaded on this visit: players withdrawn, players added (also tagged New in the list), and players moved, for example from qualifying to the main draw.
- Daily email alerts for player list changes: a Vercel cron job checks every tournament starting within the next 15 days once a day (08:00 UTC+8) and emails players withdrawn, added or moved, and lists published, compared with the day before. Uses Resend for email and Upstash Redis to keep the previous lists; setup steps are in the README. `npm run check-players` runs the same check locally.
- Auto-update is on by default for tournaments starting within 15 days; switching it off for one is remembered.
- Tournament tiles in the list view: the city (or event name for Grand Slams and Finals) on a court-style background colored by surface (hard, clay, grass; tour color when the surface is unknown), with a level badge colored by tier and the start date.

### Changed

- The live site moved to https://tennis-tournament-vercel-deploy.vercel.app, a Vercel project connected to the GitHub repo that deploys every push to `main`. The old address (vercel-deploy-nine-umber.vercel.app) no longer works.
- Filter bar is laid out in three rows: view, dates, month and search; then the tour as large logo-style tiles (ALL / ATP / WTA with a caption and count, filled with the tour color when selected); then the type tiles. With four rows of tiles (month, tour, type), the filter bar now scrolls away with the page; the month bar stays pinned at the top.
- The site always opens on the list view (it no longer remembers the last view used).
- From/To date inputs replaced by a year switcher (‹ 2026 ›). The site shows one year at a time, January to December, opening on the current year and month; other years open on All months.
- Calendar bars show the tournament level (for example WTA 1000, ATP 500, Grand Slam) instead of just the tour.
- List view status is color-coded, with a colored label and a stripe on the card's left edge: green for in progress (with a pulsing dot), blue for upcoming, grey for completed.
- Month headings are full-width bars with more contrast (larger full-strength text, accent stripe, tournament count in a pill) that stick below the filter bar while you scroll, so the current month stays visible. The filter bar is now solid instead of slightly see-through.
- Accent color changed from yellow to green: month bars use the header green, and the header ball, search highlight and selected calendar bar use bright green.

### Fixed

- The "In progress" label in the list view was meant to be orange but showed grey, because another style overrode its color.

## [1.1.0] - 2026-10-16

### Added

- Calendar view alongside the list view (List / Calendar switch, remembered per browser). Each month is a Monday–Sunday grid with tournaments drawn as bars across their dates, colored by tour; clicking a bar shows the tournament's details and player list below that month.

### Changed

- Tournament list is grouped by month (with a per-month count) instead of by week.
- Default date range covers whole months: the start of the current month through the end of the month after next.

## [1.0.0] - 2026-10-16

### Added

- Tournament calendar combining ATP and WTA events, grouped by week, with dates, city and country, plus level, surface and prize money where the source provides them.
- Player lists per tournament: the WTA pre-draw entry list (main draw and qualifying), and ATP players from the ESPN draw once it's made. Singles and doubles are shown with seeds.
- Tour filter, date range and search (tournament, city, country and loaded players).
- Links to each tournament's official page.
- Zero-dependency Node server (`server.js`) that proxies the WTA API and ESPN's ATP feed and caches responses for 10 minutes.
- Vercel version in `vercel-deploy/`: serverless API routes with responses cached at the edge for 10 minutes, deployed at https://vercel-deploy-nine-umber.vercel.app.

### Known limitations

- ATP data comes from ESPN because atptour.com blocks automated requests, so ATP tournaments have no pre-draw entry list, surface, prize money or level (levels added in a later release).

[Unreleased]: https://github.com/miaolin/tennis-tournament/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/miaolin/tennis-tournament/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/miaolin/tennis-tournament/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/miaolin/tennis-tournament/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/miaolin/tennis-tournament/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/miaolin/tennis-tournament/releases/tag/v1.0.0
