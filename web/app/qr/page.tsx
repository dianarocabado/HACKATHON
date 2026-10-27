import QrPosters from '@/components/QrPosters';

// Printable posters for the demo places: outside the (app) shell, no header or bottom nav.
export const metadata = { title: 'Heilbronn wirkt – QR-Plakate' };

export default function QrPage() {
  return <QrPosters />;
}
