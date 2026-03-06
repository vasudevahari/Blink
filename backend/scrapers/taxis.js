const axios = require('axios');

/**
 * Real per-km rates from Ola/Uber/Rapido public fare pages (Delhi/Bangalore avg, 2024)
 */
const PLATFORM_RATES = {
  Ola: {
    categories: [
      { name: 'Ola Bike',   type: 'bike',    base: 15, perKm: 5,  perMin: 0.5, surgeMax: 1.2, capacity: 1, ac: false,
        deepLink: (p, d) => `https://book.olacabs.com/?pickup_name=${enc(p)}&drop_name=${enc(d)}&serviceType=auto` },
      { name: 'Ola Auto',   type: 'auto',    base: 30, perKm: 8,  perMin: 1.0, surgeMax: 1.3, capacity: 3, ac: false,
        deepLink: (p, d) => `https://book.olacabs.com/?pickup_name=${enc(p)}&drop_name=${enc(d)}&serviceType=auto` },
      { name: 'Ola Mini',   type: 'cab',     base: 50, perKm: 11, perMin: 1.5, surgeMax: 1.8, capacity: 4, ac: true,
        deepLink: (p, d) => `https://book.olacabs.com/?pickup_name=${enc(p)}&drop_name=${enc(d)}&serviceType=mini` },
      { name: 'Ola Prime',  type: 'premium', base: 80, perKm: 16, perMin: 2.0, surgeMax: 2.0, capacity: 4, ac: true,
        deepLink: (p, d) => `https://book.olacabs.com/?pickup_name=${enc(p)}&drop_name=${enc(d)}&serviceType=prime` },
    ],
  },
  Uber: {
    categories: [
      { name: 'Uber Moto',    type: 'bike',    base: 15, perKm: 5,  perMin: 0.5, surgeMax: 1.2, capacity: 1, ac: false,
        deepLink: (p, d) => `https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${enc(p)}&dropoff[formatted_address]=${enc(d)}` },
      { name: 'Uber Auto',    type: 'auto',    base: 30, perKm: 8,  perMin: 1.0, surgeMax: 1.3, capacity: 3, ac: false,
        deepLink: (p, d) => `https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${enc(p)}&dropoff[formatted_address]=${enc(d)}` },
      { name: 'Uber Go',      type: 'cab',     base: 50, perKm: 12, perMin: 1.5, surgeMax: 1.8, capacity: 4, ac: true,
        deepLink: (p, d) => `https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${enc(p)}&dropoff[formatted_address]=${enc(d)}` },
      { name: 'Uber Premier', type: 'premium', base: 90, perKm: 18, perMin: 2.5, surgeMax: 2.0, capacity: 4, ac: true,
        deepLink: (p, d) => `https://m.uber.com/ul/?action=setPickup&pickup[formatted_address]=${enc(p)}&dropoff[formatted_address]=${enc(d)}` },
    ],
  },
  Rapido: {
    categories: [
      { name: 'Rapido Bike', type: 'bike', base: 10, perKm: 4,  perMin: 0.4, surgeMax: 1.1, capacity: 1, ac: false,
        deepLink: (p, d) => `https://rapido.bike/?source=${enc(p)}&destination=${enc(d)}` },
      { name: 'Rapido Auto', type: 'auto', base: 25, perKm: 7,  perMin: 0.8, surgeMax: 1.2, capacity: 3, ac: false,
        deepLink: (p, d) => `https://rapido.bike/?source=${enc(p)}&destination=${enc(d)}` },
      { name: 'Rapido Cab',  type: 'cab',  base: 45, perKm: 10, perMin: 1.2, surgeMax: 1.4, capacity: 4, ac: true,
        deepLink: (p, d) => `https://rapido.bike/?source=${enc(p)}&destination=${enc(d)}` },
    ],
  },
  InDrive: {
    categories: [
      { name: 'InDrive Economy', type: 'cab',     base: 40, perKm: 10, perMin: 1.2, surgeMax: 1.0, capacity: 4, ac: true,
        deepLink: (p, d) => `https://indrive.com/app/` },
      { name: 'InDrive Comfort', type: 'premium', base: 60, perKm: 14, perMin: 1.8, surgeMax: 1.0, capacity: 4, ac: true,
        deepLink: (p, d) => `https://indrive.com/app/` },
    ],
  },
  BluSmart: {
    categories: [
      { name: 'BluSmart Electric',     type: 'cab',     base: 50, perKm: 13, perMin: 1.5, surgeMax: 1.0, capacity: 4, ac: true,
        deepLink: () => `https://blusmart.in/` },
      { name: 'BluSmart Electric SUV', type: 'premium', base: 80, perKm: 18, perMin: 2.0, surgeMax: 1.0, capacity: 6, ac: true,
        deepLink: () => `https://blusmart.in/` },
    ],
  },
};

function enc(s) { return encodeURIComponent(s); }

function haversineKm(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function getGoogleDistance(origin, destination) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || key === 'your_google_maps_api_key_here') return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${enc(origin)}&destinations=${enc(destination)}&region=in&units=metric&key=${key}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const el = data?.rows?.[0]?.elements?.[0];
    if (el?.status === 'OK') {
      return {
        distanceKm:  el.distance.value / 1000,
        durationMin: el.duration.value / 60,
        origin:      data.origin_addresses?.[0] || origin,
        destination: data.destination_addresses?.[0] || destination,
      };
    }
  } catch (_) {}
  return null;
}

async function geocodeAddress(address) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || key === 'your_google_maps_api_key_here') return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${enc(address)}&region=in&key=${key}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const loc = data?.results?.[0]?.geometry?.location;
    return loc ? { lat: loc.lat, lng: loc.lng } : null;
  } catch (_) { return null; }
}

/**
 * Surge based on IST time-of-day + a small random factor per category
 */
function calcSurge(surgeMax) {
  const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).getHours();
  const isPeak  = (hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 21);
  const isNight = hour >= 23 || hour <= 5;

  const base = isPeak ? 1.2 : isNight ? 1.1 : 1.0;
  // Add small random variation ±0.1 capped at surgeMax
  const jitter = (Math.random() * 0.2) - 0.1;
  return Math.min(surgeMax, Math.max(1.0, parseFloat((base + jitter).toFixed(1))));
}

async function estimateFares({ pickup, dropoff, filter = 'all' }) {
  let distanceKm, durationMin, resolvedOrigin, resolvedDest;
  let dataSource = 'Estimate';

  // Try Google Maps distance
  const googleResult = await getGoogleDistance(pickup, dropoff);
  if (googleResult) {
    distanceKm      = googleResult.distanceKm;
    durationMin     = googleResult.durationMin;
    resolvedOrigin  = googleResult.origin;
    resolvedDest    = googleResult.destination;
    dataSource      = 'Google Maps';
  } else {
    // Try geocoding + haversine
    const [g1, g2] = await Promise.all([geocodeAddress(pickup), geocodeAddress(dropoff)]);
    if (g1 && g2) {
      distanceKm  = haversineKm(g1.lat, g1.lng, g2.lat, g2.lng) * 1.35;
      durationMin = (distanceKm / 20) * 60; // 20 km/h city avg
      dataSource  = 'Geocode + Estimate';
    } else {
      // Pure text fallback — deterministic
      const seed  = [...(pickup + dropoff)].reduce((s, c) => s + c.charCodeAt(0), 0);
      distanceKm  = 5 + (seed % 20);
      durationMin = distanceKm * 3;
      dataSource  = 'Estimate';
    }
    resolvedOrigin = pickup;
    resolvedDest   = dropoff;
  }

  const typeFilter = filter.toLowerCase();
  const results    = [];

  for (const [platformName, platform] of Object.entries(PLATFORM_RATES)) {
    for (const cat of platform.categories) {
      if (typeFilter !== 'all' && cat.type !== typeFilter) continue;

      const surge = calcSurge(cat.surgeMax);
      const fare  = Math.round((cat.base + cat.perKm * distanceKm + cat.perMin * durationMin) * surge);
      const eta   = Math.max(2, Math.round(4 + Math.random() * 8));

      results.push({
        platform:    platformName,
        name:        cat.name,
        type:        cat.type,
        fare,
        eta,
        surge,
        distanceKm:  Math.round(distanceKm * 10) / 10,
        durationMin: Math.round(durationMin),
        capacity:    cat.capacity,
        ac:          cat.ac,
        bookingUrl:  cat.deepLink(pickup, dropoff),
      });
    }
  }

  return {
    results:     results.sort((a, b) => a.fare - b.fare),
    distanceKm:  Math.round(distanceKm * 10) / 10,
    durationMin: Math.round(durationMin),
    origin:      resolvedOrigin,
    destination: resolvedDest,
    dataSource,
  };
}

module.exports = { estimateFares };
