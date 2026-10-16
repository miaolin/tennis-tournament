# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/miaolin/tennis-tournament/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/miaolin/tennis-tournament/releases/tag/v1.0.0
