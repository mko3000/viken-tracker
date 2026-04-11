import { describe, it, expect } from 'vitest';
import {
    vesselAngle,
    getCurrentSchedule,
    getCurrentScheduleDay,
    getTodaysStops,
    getNextDeparture,
} from '../js/schedule.js';
import schedule from '../data/schedule.json';

const winter = schedule.seasons.find(s => s.name === 'winter');

// ── vesselAngle ───────────────────────────────────────────────────────────────

describe('vesselAngle', () => {
    it('returns zero angle when stopped (sog=0)', () => {
        expect(vesselAngle(90, 0)).toEqual({ angle: 0, flip: false });
        expect(vesselAngle(270, 0)).toEqual({ angle: 0, flip: false });
    });

    it('heading north (0°) → angle -90, no flip', () => {
        expect(vesselAngle(0, 5)).toEqual({ angle: -90, flip: false });
    });

    it('heading east (90°) → angle 0, no flip', () => {
        expect(vesselAngle(90, 5)).toEqual({ angle: 0, flip: false });
    });

    it('heading south (180°) → angle 90, no flip', () => {
        expect(vesselAngle(180, 5)).toEqual({ angle: 90, flip: false });
    });

    it('heading west (270°) → flips the icon', () => {
        const result = vesselAngle(270, 5);
        expect(result.flip).toBe(true);
        expect(result.angle).toBe(0); // 270 - 180 - 90 = 0
    });
});

// ── getCurrentSchedule ────────────────────────────────────────────────────────

describe('getCurrentSchedule', () => {
    it('returns winter season for a date in winter', () => {
        const date = new Date('2026-01-14T10:00:00');
        const result = getCurrentSchedule(date, schedule.seasons);
        expect(result?.name).toBe('winter');
    });

    it('returns summer season for a date in summer', () => {
        const date = new Date('2026-07-01T10:00:00');
        const result = getCurrentSchedule(date, schedule.seasons);
        expect(result?.name).toBe('summer');
    });

    it('returns null outside all seasons', () => {
        // After summer ends 2026-08-31
        const date = new Date('2026-09-15T10:00:00');
        const result = getCurrentSchedule(date, schedule.seasons);
        expect(result).toBeNull();
    });
});

// ── getCurrentScheduleDay ─────────────────────────────────────────────────────

describe('getCurrentScheduleDay', () => {
    it('returns correct weekday name', () => {
        // 2026-01-14 is a Wednesday
        expect(getCurrentScheduleDay(new Date('2026-01-14T10:00:00'), winter)).toBe('wed');
        // 2026-01-10 is a Saturday
        expect(getCurrentScheduleDay(new Date('2026-01-10T10:00:00'), winter)).toBe('sat');
    });

    it('returns holiday schedule on a full-day holiday', () => {
        // 2025-12-06 Finnish Independence Day → uses sat schedule
        expect(getCurrentScheduleDay(new Date('2025-12-06T10:00:00'), winter)).toBe('sat');
    });

    it('applies holiday until-time: before cutoff → holiday schedule', () => {
        // 2025-12-24 uses sun schedule until 16:30
        const before = new Date('2025-12-24T14:00:00');
        expect(getCurrentScheduleDay(before, winter)).toBe('sun');
    });

    it('applies holiday until-time: after cutoff → normal weekday', () => {
        // 2025-12-24 is a Wednesday; after 16:30 the holiday no longer applies
        const after = new Date('2025-12-24T17:00:00');
        expect(getCurrentScheduleDay(after, winter)).toBe('wed');
    });
});

// ── getTodaysStops ────────────────────────────────────────────────────────────

describe('getTodaysStops', () => {
    // 2026-01-14 Wednesday — weekday schedule
    const wednesday = new Date('2026-01-14T00:00:00');

    it('returns Granvik departures on a weekday (not final stop of trip)', () => {
        const stops = getTodaysStops('Granvik', wednesday, winter);
        // t01 06:00, t02 07:45, t03 08:15, … all Granvik non-terminal stops
        expect(stops.timeStrings.length).toBeGreaterThan(4);
        expect(stops.timeStrings[0]).toBe('06:00');
        expect(stops.timeStrings[1]).toBe('07:45');
    });

    it('marks approximate stops with asterisk', () => {
        // t01 Pensar 06:35 is approx
        const stops = getTodaysStops('Pensar', wednesday, winter);
        expect(stops.timeStrings[0]).toBe('06:35*');
    });

    it('returns weekend stops on a Saturday', () => {
        const saturday = new Date('2026-01-10T00:00:00');
        const stops = getTodaysStops('Granvik', saturday, winter);
        // t02w starts at 10:00
        expect(stops.timeStrings[0]).toBe('10:00');
    });

    it('does not include the final stop of a round trip as a departure', () => {
        // Granvik is the last stop of t01 (07:45 return) — but also appears as first stop.
        // Only the outbound 06:00 departure should appear, not the 07:45 terminal arrival.
        const stops = getTodaysStops('Granvik', wednesday, winter);
        const times = stops.times.map(t => `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`);
        // Every time should correspond to a non-final Granvik stop in some trip.
        // The simplest check: 07:45 appears as t02 departure, not as t01 return arrival.
        const count = times.filter(t => t === '7:45').length;
        expect(count).toBe(1); // only t02's Granvik departure, not t01's return
    });
});

// ── getNextDeparture ──────────────────────────────────────────────────────────

describe('getNextDeparture', () => {
    it('returns the next upcoming departure after the current time', () => {
        // At 07:50 on a weekday, 06:00 and 07:45 are past; next is 08:15
        const at0750 = new Date('2026-01-14T07:50:00');
        expect(getNextDeparture('Granvik', at0750, winter)).toBe('08:15');
    });

    it('returns the very next departure when current time is just before', () => {
        // One minute before t01 departure
        const at0559 = new Date('2026-01-14T05:59:00');
        expect(getNextDeparture('Granvik', at0559, winter)).toBe('06:00');
    });

    it('returns null when all departures are past', () => {
        // After the last departure of the day
        const lateNight = new Date('2026-01-14T23:59:00');
        expect(getNextDeparture('Granvik', lateNight, winter)).toBeNull();
    });

    it('uses the holiday schedule on a public holiday', () => {
        // 2025-12-06 Independence Day uses sat schedule (t02w first at 10:00)
        const at0900 = new Date('2025-12-06T09:00:00');
        expect(getNextDeparture('Granvik', at0900, winter)).toBe('10:00');
    });
});
