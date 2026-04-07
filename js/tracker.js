import routeData from '../data/schedule.json' with { type: 'json' };
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

// Init map — centered on Finnish SW archipelago 
map = L.map('map', { zoomControl: true, attributionControl: true }).setView([60.17, 22.21], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
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
    width:16px;height:16px;
    background:var(--accent,#00c8ff);
    border:2px solid #fff;
    border-radius:50%;
    box-shadow:0 0 0 4px rgba(0,200,255,0.25), 0 0 16px rgba(0,200,255,0.5);
  "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    className: ''
});

const harbors = routeData.harbors;
for (const harbor of harbors) {
    console.log(harbor.name, ": [", harbor.lat, ",", harbor.lon, "]");
    const harborMarker = L.marker([harbor.lat, harbor.lon], {
        icon: harborIcon
    }).addTo(map);
    harborMarker.bindPopup(`<b>${harbor.name}</b>`);
}

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

function setStatus(state, text) {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    dot.className = 'pulse-dot ' + (state === 'live' ? 'live' : state === 'error' ? 'error' : '');
    txt.textContent = text;
}

function showError(msg) {
    const el = document.getElementById('errorMsg');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 6000);
}

function formatTime(epoch) {
    const d = new Date(epoch * 1000);
    return d.toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function setCompass(degrees) {
    document.getElementById('compassNeedle').style.transform = `rotate(${degrees}deg)`;
}

function el(id, val) { document.getElementById(id).innerHTML = val; }

function vesselAngle(degrees, sog) {
    if (sog === 0) return { angle: 0, flip: false };
    const flip = degrees > 180;
    if (flip) degrees -= 180;
    degrees -= 90;
    return { angle: degrees, flip };
}

async function fetchVessel() {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinning">↻</span> &nbsp;Fetching…';
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
            setStatus('error', 'No AIS data');
            showError('No AIS signal received for Viken. Vessel may be in port or out of coverage.');
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

        setStatus('live', `Live · updated ${formatTime(ts ? (typeof ts === 'number' && ts > 1e10 ? ts / 1000 : ts) : Date.now() / 1000)}`);

    } catch (e) {
        setStatus('error', 'Fetch failed');
        showError(`API error: ${e.message}`);
        console.error(e);
    }

    btn.disabled = false;
    btn.innerHTML = '↻ &nbsp;Refresh Now';
    resetCountdown();
}

function resetCountdown() {
    clearInterval(timer);
    countdown = REFRESH_SEC;
    timer = setInterval(() => {
        countdown--;
        const cd = document.getElementById('countdown');
        if (countdown > 0) {
            cd.textContent = `Auto-refresh in ${countdown}s`;
        } else {
            cd.textContent = 'Refreshing…';
            fetchVessel();
        }
    }, 1000);
}

// Start
fetchVessel();
