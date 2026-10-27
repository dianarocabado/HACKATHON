import { Suspense } from 'react';
import ReportFlow from '@/components/ReportFlow';

// ReportFlow reads ?h3= (QR code / map tap), which is runtime data under Cache Components.
export default function ReportPage() {
  return (
    <Suspense fallback={<p className="p-4">Lade …</p>}>
      <ReportFlow />
    </Suspense>
  );
}
