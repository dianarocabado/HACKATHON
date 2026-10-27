// Location helpers and result sentences for the report flow.
import { cellToLatLng, isValidCell } from 'h3-js';
import type { SensorCheck } from '@contracts/types';

export interface Place { lat: number; lng: number; label: string; source: 'qr' | 'gps' }

/** Location from a QR code or map tap (`?h3=`), or null if the cell is invalid. */
export function placeFromH3(h3: string | null, label?: string | null): Place | null {
  if (!h3 || !isValidCell(h3)) return null;
  const [lat, lng] = cellToLatLng(h3);
  return { lat, lng, label: label || 'Gewählter Ort', source: 'qr' };
}

/** Browser GPS with the project-wide 8 s limit. */
export function placeFromGps(timeoutMs = 8000): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('no geolocation')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'Dein Standort', source: 'gps' }),
      reject,
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

const num = (v: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(v);

/** One friendly sentence about what the nearest sensor says. */
export function sensorSentence(c: SensorCheck): string {
  // Non-breaking space keeps number and unit on one line.
  const reading = c.value != null ? `${num(c.value)}${c.unit ? `\u00a0${c.unit}` : ''}` : null;
  const where = c.distM != null ? `, ${Math.round(c.distM)}\u00a0m entfernt` : '';
  if (c.status === 'confirmed') return `Der Sensor bestätigt das${reading ? `: ${reading}` : ''}${where}.`;
  if (c.status === 'not_confirmed') {
    return `Der Sensor in der Nähe misst gerade ${reading ?? 'nichts Auffälliges'}${where}. Deine Meldung zählt trotzdem.`;
  }
  return 'Kein Sensor in der Nähe. Magst du einen aufhängen?';
}
