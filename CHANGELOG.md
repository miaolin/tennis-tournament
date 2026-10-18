# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Fixed

- Daily email alerts didn't find the Upstash Redis settings when the store was connected with a name prefix (for example `tennis_tournament_KV_REST_API_URL`). Prefixed and unprefixed names now both work.

### Changed

- Player lists no longer have an Auto-update switch. Instead, an open list reloads by itself once it's an hour old, and so does a list you reopen after an hour. Tournaments that have finished aren't reloaded. Previously Auto-update reloaded every 5 minutes, and lists reopened after 10 minutes reloaded. The Update button still reloads at any time, and the daily email check is unchanged.
- README: the email alerts section now says they're live, gives a one-line test that works with Vercel's encrypted `CRON_SECRET`, and notes that the first alerts may land in spam.

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

[Unreleased]: https://github.com/miaolin/tennis-tournament/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/miaolin/tennis-tournament/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/miaolin/tennis-tournament/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/miaolin/tennis-tournament/releases/tag/v1.0.0
