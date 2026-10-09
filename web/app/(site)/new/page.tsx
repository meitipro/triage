import type { Metadata } from 'next';

import { OpenProgramForm } from '@/components/OpenProgramForm';

export const metadata: Metadata = { title: 'Open a program' };

export default function NewProgram() {
  return (
    <div className="c-wrap py-12">
      <p className="c-eyebrow">For teams</p>
      <h1 className="c-h2 mt-2">Open a program</h1>
      <p className="c-lead mt-4">
        Write the scope once, set the reward, the stake and the weekly cap, and fund the pool. Validators do the reading;
        you get the queue.
      </p>
      <div className="mt-8">
        <OpenProgramForm />
      </div>
    </div>
  );
}
