import Link from 'next/link';

import { WalletButton } from './Wallet';

/**
 * The site's mark, the same drawing as app/icon.svg without its ground: a
 * funnel of three bars, where only the shortest gets through. It sits in the
 * middle of its square, so a circular crop keeps all of it.
 */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="106 106 300 300" aria-hidden style={{ flexShrink: 0 }}>
      <rect x="106" y="106" width="300" height="300" rx="46" fill="#a3e635" />
      <rect x="166" y="178" width="180" height="30" rx="8" fill="#142003" />
      <rect x="196" y="241" width="120" height="30" rx="8" fill="#142003" />
      <rect x="226" y="304" width="60" height="30" rx="8" fill="#142003" />
    </svg>
  );
}

export function Nav() {
  return (
    <header className="c-nav">
      <div className="c-wrap c-nav-row">
        <Link href="/" className="c-brand" aria-label="Triage home">
          <Mark />
          triage
        </Link>
        <nav className="c-links" aria-label="Main">
          <Link href="/programs">Programs</Link>
          <Link href="/reports">Reports</Link>
          <Link href="/#teams">For teams</Link>
          <Link href="/docs">Docs</Link>
        </nav>
        <div className="c-nav-right">
          <span className="c-pill hidden sm:inline-flex" title="GenLayer Studio Next, chain 61997">
            <span className="dot" />
            Studio Next
          </span>
          <WalletButton />
          <Link href="/new" className="c-btn small solid hidden sm:inline-flex">
            Open a program
          </Link>
        </div>
      </div>
      <nav className="c-links-mobile c-wrap" aria-label="Main, small screens">
        <Link href="/programs">Programs</Link>
        <Link href="/reports">Reports</Link>
        <Link href="/me">My reports</Link>
        <Link href="/new">Open a program</Link>
        <Link href="/docs">Docs</Link>
      </nav>
    </header>
  );
}
