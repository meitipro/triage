import type { Metadata } from 'next';

import { MePanel } from '@/components/MePanel';

export const metadata: Metadata = { title: 'My reports' };

export default function Me() {
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">Tester page</p>
      <h1 className="c-h2 mt-2">My reports</h1>
      <p className="c-lead mt-4">
        Your reports and their verdicts, your acceptance rate, and your balance. Rewards, refunded stakes and bonuses wait
        here until you withdraw them.
      </p>
      <div className="mt-8">
        <MePanel />
      </div>
    </div>
  );
}
