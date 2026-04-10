# Viken Tracker — Agent Instructions

## Project
Live AIS tracker for M/S Viken (MMSI 230987260, callsign OIRW), a FinFerries passenger ferry on the Pargas route in the Finnish archipelago.

Schedule data lives in `data/schedule.json`. Source PDFs are in `misc/`. The booking system is at https://booking.finferries.fi.

---

## Updating schedule.json from a new PDF

### Workflow
1. Read the new PDF from `misc/`
2. Extract all Granvik departure times and which harbors each trip visits (the PDF marks stops with "y")
3. The PDF only shows official timed stops (always Granvik, sometimes Pensar). All intermediate harbor times must be calculated using the logic below.
4. Compare with the existing `data/schedule.json` structure and update accordingly.

### JSON structure

```json
{
  "vessel": "m/s Viken",
  "phone": "0400 320099",
  "bookingUrl": "https://booking.finferries.fi",
  "harbors": [ ... ],
  "seasons": [
    {
      "name": "winter",
      "valid": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
      "maxPassengers": 73,
      "notes": { ... },
      "publicHolidays": [ ... ],
      "trips": [
        {
          "id": "t01",
          "days": ["mon", "tue", "wed", "thu", "fri"],
          "stops": [
            { "name": "Granvik", "time": "06:00" },
            { "name": "Pensar", "time": "06:35", "approx": true },
            ...
            { "name": "Granvik", "time": "07:45" }
          ]
        }
      ]
    }
  ]
}
```

- Official timed stops (from the PDF): no `"approx"` flag
- Calculated intermediate stops: add `"approx": true`
- Days: `"mon"`, `"tue"`, `"wed"`, `"thu"`, `"fri"`, `"sat"`, `"sun"`
- Trip IDs: `t01`, `t02`, ... with suffixes `w` (weekend), `f` (Friday-only) as needed

---

## Harbor geography (outbound order from Granvik)

```
Granvik (main harbor, mainland side)
  ↓ ~10 min outbound
Heisala (south of Granvik — visited on inner loops and return legs)
  ↓
Björkholm (west of Heisala — 1 min from Heisala in either direction)
  ↓ ~10 min
Aspholm
  ↓ ~10 min
Kuggö
  ↓ ~15 min
Pensar (farthest stop)
```

**Key geographic note:** When going *outbound* to the outer islands, the boat goes Granvik → Björkholm *directly* (10 min), skipping Heisala. Heisala is only visited on the return leg or on dedicated Heisala short trips. The route is not a simple line — Heisala is a detour off the main outer-island route.

---

## Timing logic for intermediate harbors

### Standard leg durations

| Leg | Time |
|-----|------|
| Granvik → Björkholm (outbound, direct) | 10 min |
| Björkholm → Aspholm | 10 min |
| Aspholm → Kuggö | 10 min |
| Kuggö → Pensar | 15 min |
| Pensar → Kuggö (return) | 10 min |
| Kuggö → Aspholm (return) | 10 min |
| Aspholm → Björkholm (return) | 10 min |
| Björkholm → Granvik (return) | 10 min |
| Granvik → Heisala (inner loop) | 10 min |
| Heisala → Björkholm | **1 min** |
| Björkholm → Heisala | **10 min** |
| Heisala → Granvik | 10–15 min |

### Granvik → Aspholm (when Björkholm is not a stop)
Always **20 min** — the boat passes through the Björkholm area without docking (10 + 10).

### Heisala ↔ Björkholm: always 1 min (Heisala→Björkholm) or 10 min (Björkholm→Heisala)
This is what the booking system consistently shows. It seems physically short but is confirmed correct. Apply it to all trips.

### Full Pensar round trip
Total duration is consistently **90–95 min**. Use this as a sanity check.

### Route variants
- **Outer island trip (Pensar):** Granvik → Björkholm → Aspholm → Kuggö → Pensar → [return via same stops] → Granvik
  - Return may go via Björkholm or Heisala depending on the trip
- **Inner Heisala loop:** Granvik → Heisala → [maybe Björkholm] → Granvik
- **Early morning t01:** Granvik → Pensar (direct, 35 min, no intermediate stops) → Kuggö → Aspholm → Björkholm → Heisala → Granvik

---

## Verifying intermediate times

After calculating times, verify them against the booking system at https://booking.finferries.fi if any leg seems inconsistent with the table above. The booking system is the authoritative source for intermediate harbor times — even if the estimates seem unrealistically short (e.g. 1 min between Heisala and Björkholm), use what the booking system shows.

Trips to double-check (have shown unusual timing in the past):
- Short Heisala-only trips (t02, t04, t06): Granvik→Heisala is 10 min
- t05 (12:15 weekday): long gap between Björkholm and return to Granvik is normal — likely a layover or unlisted stop
- Friday-only late trips (t10f, t11): follow the same leg logic but verify with booking system

---

## Season structure
- **Winter:** typically Sep 1 – May 31, maxPassengers 73
- **Summer:** typically Jun 1 – Aug 31, maxPassengers 99
- Weekend trips use suffix `w` (e.g. `t03w`); they often differ from weekday trips
- Public holidays override the day's schedule — check the PDF notes section

---

## Request stops (not in booking system)
- **Granholmen:** deviates if ordered, except on certain Heisala-only trips. Not listed as a regular stop in trips.
- **Stenholm:** deviates if ordered on Pensar trips.
- **Ramsholm:** used when circumstances require.
These are defined in `harbors` with `"regular": false` and described in season `notes`. Do not add them as stops in trips unless the PDF explicitly lists them.
