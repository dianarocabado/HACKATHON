import { Suspense } from 'react';
import ReportFlow from '@/components/ReportFlow';

// ReportFlow reads ?h3= (QR code / map tap), which is runtime data under Cache Components.
export default function ReportPage() {
  return (
    <Suspense fallback={<div aria-busy className="m-4 h-40 animate-pulse rounded-2xl" style={{ background: 'var(--border)' }} />}>
      <ReportFlow />
    </Suspense>
  );
}
