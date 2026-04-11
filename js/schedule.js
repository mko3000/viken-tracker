/**
 * Pure schedule logic — no DOM or Leaflet dependencies.
 * All functions take explicit arguments so they can be unit-tested.
 */

export function formatTime(epoch) {
    const d = new Date(epoch * 1000);
    return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function vesselAngle(degrees, sog) {
    if (sog === 0) return { angle: 0, flip: false };
    const flip = degrees > 180;
    if (flip) degrees -= 180;
    degrees -= 90;
    return { angle: degrees, flip };
}

export function getCurrentSchedule(curTime, seasons) {
    for (const season of seasons) {
        if (curTime >= Date.parse(season.valid.from) && curTime < Date.parse(season.valid.to)) {
            return season;
        }
    }
    return null;
}

export function getCurrentScheduleDay(curTime, schedule) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    let weekday = days[curTime.getDay()];
    const y = curTime.getFullYear();
    const m = String(curTime.getMonth() + 1).padStart(2, '0');
    const d = String(curTime.getDate()).padStart(2, '0');
    const dateString = `${y}-${m}-${d}`;
    const holiday = schedule.publicHolidays.find(h => h.date === dateString);
    if (holiday) {
        if ('until' in holiday) {
            const until = new Date(`${holiday.date}T${holiday.until}:00`);
            if (curTime < until) weekday = holiday.usesSchedule;
        } else {
            weekday = holiday.usesSchedule;
        }
    }
    return weekday;
}

export function getTodaysStops(harbor, curTime, schedule) {
    const stops = { timeStrings: [], times: [] };
    const weekday = getCurrentScheduleDay(curTime, schedule);
    for (const trip of schedule.trips) {
        if (!trip.days.includes(weekday)) continue;
        const lastStop = trip.stops[trip.stops.length - 1];
        for (const stop of trip.stops) {
            if (stop.name === harbor && stop !== lastStop) {
                const stopString = stop.approx ? stop.time + '*' : stop.time;
                const [h, min] = stop.time.split(':').map(Number);
                const stopTime = new Date(curTime.getFullYear(), curTime.getMonth(), curTime.getDate(), h, min);
                stops.timeStrings.push(stopString);
                stops.times.push(stopTime);
            }
        }
    }
    return stops;
}

export function getNextDeparture(harbor, curTime, schedule) {
    const stops = getTodaysStops(harbor, curTime, schedule);
    for (let i = 0; i < stops.times.length; i++) {
        if (stops.times[i] > curTime) return stops.timeStrings[i];
    }
    return null;
}
