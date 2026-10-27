import BigScreen from '@/components/BigScreen';

// Big-screen mode for the pitch: outside the (app) shell, so no header or bottom nav.
export const metadata = { title: 'Heilbronn wirkt – Live' };

export default function ScreenPage() {
  return <BigScreen />;
}
