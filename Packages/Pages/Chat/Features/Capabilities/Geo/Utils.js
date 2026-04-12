export async function nominatimJson(url) {
  return (await fetch(url, { headers: { 'User-Agent': 'ClaudeGeoTools/1.0 (claude.ai)' } })).json();
}
export function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180,
    dLon = ((lon2 - lon1) * Math.PI) / 180,
    a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180,
    φ2 = (lat2 * Math.PI) / 180,
    Δλ = ((lon2 - lon1) * Math.PI) / 180,
    y = Math.sin(Δλ) * Math.cos(φ2),
    x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((180 * Math.atan2(y, x)) / Math.PI + 360) % 360;
}
export function cardinalDir(bearing) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
}
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
export function encodeGeohash(lat, lon, precision = 9) {
  let idx = 0,
    bit = 0,
    evenBit = !0,
    hash = '',
    [minLat, maxLat, minLon, maxLon] = [-90, 90, -180, 180];
  for (; hash.length < precision; ) {
    if (evenBit) {
      const mid = (minLon + maxLon) / 2;
      lon >= mid ? ((idx = 2 * idx + 1), (minLon = mid)) : ((idx *= 2), (maxLon = mid));
    } else {
      const mid = (minLat + maxLat) / 2;
      lat >= mid ? ((idx = 2 * idx + 1), (minLat = mid)) : ((idx *= 2), (maxLat = mid));
    }
    ((evenBit = !evenBit), 5 === ++bit && ((hash += BASE32[idx]), (bit = 0), (idx = 0)));
  }
  return hash;
}
export function decodeGeohash(hash) {
  let evenBit = !0,
    [minLat, maxLat, minLon, maxLon] = [-90, 90, -180, 180];
  for (const c of hash) {
    const chr = BASE32.indexOf(c);
    if (-1 === chr) throw new Error(`Invalid geohash character: ${c}`);
    for (let bits = 4; bits >= 0; bits--) {
      const bitN = (chr >> bits) & 1;
      if (evenBit) {
        const mid = (minLon + maxLon) / 2;
        bitN ? (minLon = mid) : (maxLon = mid);
      } else {
        const mid = (minLat + maxLat) / 2;
        bitN ? (minLat = mid) : (maxLat = mid);
      }
      evenBit = !evenBit;
    }
  }
  return {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
    latErr: (maxLat - minLat) / 2,
    lonErr: (maxLon - minLon) / 2,
    bounds: { minLat: minLat, maxLat: maxLat, minLon: minLon, maxLon: maxLon },
  };
}
