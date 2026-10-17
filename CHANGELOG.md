# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Calendar bars show the tournament level (WTA 125 / 250 / 500 / 1000, WTA Finals, Grand Slam) instead of just the tour. ATP events other than Grand Slams still show "ATP", because ESPN doesn't provide their level.

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

- ATP data comes from ESPN because atptour.com blocks automated requests, so ATP tournaments have no pre-draw entry list, surface, prize money or level.

[Unreleased]: https://github.com/miaolin/tennis-tournament/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/miaolin/tennis-tournament/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/miaolin/tennis-tournament/releases/tag/v1.0.0
