import routeData from '../data/schedule.json' with { type: 'json' };
import { formatTime, vesselAngle, getCurrentSchedule, getNextDeparture } from './schedule.js';
console.log(`Tracking the ${routeData.vessel}`);

const MMSI = 230987260;
const API = `https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${MMSI}`;
const REFRESH_SEC = 30;

const NAV_STATUS = {
    0: 'Under way (engine)',
    1: 'At anchor',
    2: 'Not under command',
    3: 'Restricted manoeuvring',
    5: 'Moored',
    8: 'Under way (sailing)',
    15: 'Undefined'
};


let map, marker, polyline;
let trail = [];
let countdown = REFRESH_SEC;
let timer;
const curTime = new Date();
const curShcedule = getCurrentSchedule(curTime, routeData.seasons);

// Init map — centered on Pargas archipelago 
map = L.map('map', { zoomControl: true, attributionControl: true }).setView([60.17, 22.21], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO | AIS data: Digitraffic/Fintraffic',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

map.on('zoomend', () => {
    if (marker) {
        marker.setIcon(createVesselIcon(lastFlip));
        updateTooltip();
    }
});

let lastFlip = false;
let lastAngle = 0;

const harborIcon = L.divIcon({
    html: `<div style="
    width:14px;height:14px;
    background:#1B2D52;
    border:2px solid #C8890F;
    border-radius:50%;
    box-shadow:0 2px 6px rgba(27,45,82,0.35);
  "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    className: ''
});

const harbors = routeData.harbors;
const harborNames = [];
for (const harbor of harbors) {
    let nextDeparture;
    if ("regular" in harbor && !harbor.regular) {
        // pass
    } else {
        nextDeparture = getNextDeparture(harbor.name, curTime, curShcedule);
    }
    const harborMarker = L.marker([harbor.lat, harbor.lon], {
        icon: harborIcon
    }).addTo(map);
    let harborText = `<div class="harbor-label-name">${harbor.name}</div>`
    if (nextDeparture !== undefined && nextDeparture !== null) harborText += `<div class="harbor-label-departure">${nextDeparture}</div>`
    harborMarker.bindTooltip(
        harborText,
        {
            className: 'harbor-label'
        }
    );
}

const granvikDep = getNextDeparture("Granvik", curTime, curShcedule);
document.getElementById('granvikDep').textContent = granvikDep ?? '—';

function iconDimensions() {
    const scale = Math.pow(2, (map.getZoom() - 13) * 0.5);
    const w = Math.min(Math.max(Math.round(53 * scale), 53), 126);
    const h = Math.min(Math.max(Math.round(19 * scale), 19), 38);
    return { w, h };
}

function createVesselIcon(flip) {
    lastFlip = flip;
    const { w, h } = iconDimensions();
    return L.divIcon({
        html: `<img src="assets/viken_pixel.png" style="width:${w}px;height:${h}px;display:block;${flip ? 'transform:scaleX(-1)' : ''}">`,
        iconSize: [w, h],
        iconAnchor: [Math.round(w / 2), Math.round(h / 2)],
        className: ''
    });
}

function updateTooltip() {
    if (!marker) return;
    const { w, h } = iconDimensions();
    const rad = lastAngle * Math.PI / 180;
    const topExtent = w / 2 * Math.abs(Math.sin(rad)) + h / 2 * Math.abs(Math.cos(rad));
    marker.unbindTooltip();
    marker.bindTooltip('Viken', {
        permanent: true, direction: 'top', offset: [0, -(topExtent + 6)],
        className: 'vessel-label'
    }).openTooltip();
}

function setStatus(state, html) {
    const txt = document.getElementById('statusText');
    txt.innerHTML = html;
    txt.style.color = state === 'error' ? 'var(--warn)' : '';
}


function setCompass(degrees) {
    document.getElementById('compassNeedle').style.transform = `rotate(${degrees}deg)`;
}

function el(id, val) { document.getElementById(id).innerHTML = val; }

async function fetchVessel() {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinning">↻</span> &nbsp;Refreshing…';
    setStatus('', 'Fetching…');

    try {
        const res = await fetch(API);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // The API returns a FeatureCollection or array — handle both
        let features = [];
        if (data.type === 'FeatureCollection') features = data.features;
        else if (Array.isArray(data)) features = data;

        if (!features.length) {
            setStatus('error', 'No AIS signal — vessel may be in port or out of coverage');
            btn.disabled = false;
            btn.innerHTML = '↻ &nbsp;Refresh Now';
            return;
        }

        const f = features[0];
        const props = f.properties || f;
        const coords = f.geometry ? f.geometry.coordinates : [props.lon, props.lat];
        const lon = coords[0], lat = coords[1];

        const sog = props.sog ?? props.speed ?? '—';
        const cog = props.cog ?? props.course ?? '—';
        const heading = props.heading ?? '—';
        const navStat = props.navStat ?? props.navigationStatus ?? 15;
        const ts = props.timestampExternal || props.time || props.timestamp;

        // Update sidebar
        el('sog', sog !== '—' ? `${parseFloat(sog).toFixed(1)}<span class="stat-unit">kn</span>` : '—');
        el('cog', cog !== '—' ? `${parseFloat(cog).toFixed(1)}<span class="stat-unit">°</span>` : '—');
        el('heading', heading !== '—' ? `${heading}<span class="stat-unit">°</span>` : '—');
        el('lat', lat.toFixed(5) + ' N');
        el('lon', lon.toFixed(5) + ' E');
        el('pos', `${lat.toFixed(3)} N, ${lon.toFixed(3)} E`);
        el('lastFix', ts ? formatTime(typeof ts === 'number' && ts > 1e10 ? ts / 1000 : ts) : '—');
        el('navStat', NAV_STATUS[navStat] ?? `Code ${navStat}`);

        if (heading !== '—' && heading !== 511) setCompass(heading);
        else if (cog !== '—') setCompass(cog);

        // Map: move marker
        const latlng = [lat, lon];
        let { angle, flip } = vesselAngle(heading, sog);
        lastAngle = angle;
        if (!marker) {
            marker = L.marker(latlng, {
                icon: createVesselIcon(flip),
                rotationAngle: angle,
                rotationOrigin: 'center'
            }).addTo(map);
            updateTooltip();
            map.setView(latlng, 13);
        } else {
            marker.setLatLng(latlng);
            marker.setIcon(createVesselIcon(flip));
            marker.setRotationAngle(angle);
            updateTooltip();
        }

        // Trail
        trail.push(latlng);
        if (trail.length > 60) trail.shift();
        if (polyline) map.removeLayer(polyline);
        if (trail.length > 1) {
            polyline = L.polyline(trail, {
                color: '#00c8ff', weight: 2, opacity: 0.35, dashArray: '5 6'
            }).addTo(map);
        }

        const fetchedAt = formatTime(Date.now() / 1000);
        const aisAt = ts ? formatTime(typeof ts === 'number' && ts > 1e10 ? ts / 1000 : ts) : '—';
        setStatus('live', `<span style="white-space:nowrap">fetched ${fetchedAt}</span><br><span style="white-space:nowrap">AIS ${aisAt}</span>`);

    } catch (e) {
        setStatus('error', `Fetch failed: ${e.message}`);
        console.error(e);
    }

    btn.disabled = false;
    resetCountdown();
}

function resetCountdown() {
    clearInterval(timer);
    countdown = REFRESH_SEC;
    const btn = document.getElementById('refreshBtn');
    btn.innerHTML = `↻ &nbsp;Refresh Now (${countdown}s)`;
    timer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            btn.innerHTML = `↻ &nbsp;Refresh Now (${countdown}s)`;
        } else {
            fetchVessel();
        }
    }, 1000);
}

// Start
document.getElementById('refreshBtn').addEventListener('click', fetchVessel);
fetchVessel();
