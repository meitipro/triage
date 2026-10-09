import Link from 'next/link';

import { DEPLOYMENT } from '@/lib/genlayer-core.mjs';
import { short, shortHash } from '@/lib/format';
import { KIND_LABEL, STATUS_LABEL } from '@/lib/labels';
import type { Kind, Status } from '@/lib/types';

export const EXPLORER = DEPLOYMENT.explorer as string;
export const CONTRACT = DEPLOYMENT.triage as string;

export function txUrl(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${EXPLORER}/address/${address}`;
}

export function Tx({ hash, label }: { hash?: string; label?: string }) {
  if (!hash) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={txUrl(hash)} target="_blank" rel="noreferrer">
      {label ? `${label} ` : ''}
      {shortHash(hash)} ↗
    </a>
  );
}

export function Addr({ address }: { address: string }) {
  if (!address) return null;
  return (
    <a className="c-link mono text-[12.5px]" href={addressUrl(address)} target="_blank" rel="noreferrer" title={address}>
      {short(address)}
    </a>
  );
}

/**
 * A verdict. Lime for actionable, the duplicate's link in its label, grey and
 * struck through for low effort, neutral for everything else.
 */
export function StatusBadge({ status, duplicateOf }: { status: Status; duplicateOf?: number }) {
  const cls = { ACTIONABLE: 'yes', DUPLICATE: 'dup', OUT_OF_SCOPE: 'oos', LOW_EFFORT: 'low', FILED: 'filed' }[status];
  const label = STATUS_LABEL[status] + (status === 'DUPLICATE' && duplicateOf ? ` · #${duplicateOf}` : '');
  return <span className={`c-verdict ${cls}`}>{label}</span>;
}

export function KindTag({ kind }: { kind: Kind }) {
  return <span className="c-kind">{KIND_LABEL[kind] ?? kind}</span>;
}

/** The program's two letters, the way the spec draws "OW" for Orrin Wallet. */
export function Initials({ name, size = 40 }: { name: string; size?: number }) {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const letters = ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || 'P';
  return (
    <span className="c-initials" style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>
      {letters}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="c-note">{children}</div>;
}

export function ReadError({ message }: { message: string }) {
  return (
    <div className="c-card pad">
      <p className="font-medium">The chain did not answer.</p>
      <p className="c-muted mt-1 text-[14px]">{message}</p>
    </div>
  );
}

export function ReportLink({ id, title }: { id: number; title: string }) {
  return (
    <Link href={`/r/${id}`} className="hover:text-[var(--accent-ink)]">
      <span className="mono c-faint mr-2 text-[12.5px]">#{id}</span>
      {title}
    </Link>
  );
}
