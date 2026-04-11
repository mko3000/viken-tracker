# Viken Tracker

[![Tests](https://github.com/mko3000/viken-tracker/actions/workflows/deploy.yml/badge.svg)](https://github.com/mko3000/viken-tracker/actions/workflows/deploy.yml)
[![AIS data: Digitraffic](https://img.shields.io/badge/AIS_data-Digitraffic%2FFintraffic-003087)](https://www.digitraffic.fi/en/marine-traffic/)
[![Built with Leaflet](https://img.shields.io/badge/Built_with-Leaflet-199900)](https://leafletjs.com)

Live map tracker for **M/S Viken** (MMSI 230987260), a FinFerries passenger ferry on the Pargas archipelago route in southwest Finland.

## Features

- Real-time vessel position from the [Digitraffic AIS API](https://www.digitraffic.fi/en/marine-traffic/), refreshed every 30 seconds
- Movement trail showing the last 60 position fixes
- Harbor markers with next scheduled departure times
- Schedule-aware: weekday, weekend, and public holiday timetables

## Route

Granvik · Heisala · Björkholm · Aspholm · Kuggö · Pensar

## Development

```sh
npm test           # run tests once
npm run test:watch # watch mode
```

Schedule data is in [`data/schedule.json`](data/schedule.json). See [`CLAUDE.md`](CLAUDE.md) for instructions on updating the schedule from a new PDF timetable.
