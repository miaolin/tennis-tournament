# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- ATP tournament levels (ATP 250 / 500 / Masters 1000, ATP Finals, Next Gen ATP Finals). ESPN doesn't provide them, so they come from a hand-maintained table in the server code, keyed by ESPN's tournament number.
- Month filter: narrows the list to tournaments starting that month, or the calendar to that month's grid.
- Tournament type selector as large icon tiles, each with a count: All types (grid icon), Grand Slam (trophy), 1000 / 500 / 250 / 125 (the number in its level color), Finals (star). They follow the tour tab: ATP has no 125 tile and its 1000 tile is captioned ATP Masters; under All, 1000 covers WTA 1000 and ATP Masters 1000.
- Tournament tiles in the list view: the city (or event name for Grand Slams and Finals) on a court-style background colored by surface (hard, clay, grass; tour color when the surface is unknown), with a level badge colored by tier and the start date.

### Changed

- Filter bar is laid out in three rows: view, dates, month and search; then the tour as large logo-style tiles (ALL / ATP / WTA with a caption and count, filled with the tour color when selected); then the type tiles. On phones it scrolls away with the page instead of staying pinned.
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

[Unreleased]: https://github.com/miaolin/tennis-tournament/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/miaolin/tennis-tournament/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/miaolin/tennis-tournament/releases/tag/v1.0.0
