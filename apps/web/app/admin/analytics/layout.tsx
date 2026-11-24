import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AnalyticsTabs } from '@/components/analytics/tabs';

export const metadata = { title: 'Analytics' };

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <h1 className="display-title text-2xl font-black">Analytics</h1>
      <Suspense fallback={null}><AnalyticsTabs /></Suspense>
      {children}
    </div>
  );
}
