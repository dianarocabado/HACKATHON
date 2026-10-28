import BigScreen from '@/components/BigScreen';

// Big-screen mode for the pitch: outside the (app) shell, so no header or bottom nav.
export const metadata = { title: 'HN Reacts – Live' };

export default function ScreenPage() {
  return <BigScreen />;
}
