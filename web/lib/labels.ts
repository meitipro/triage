import type { Kind, Status } from './types';

export const STATUS_LABEL: Record<Status, string> = {
  FILED: 'Filed',
  ACTIONABLE: 'Actionable',
  DUPLICATE: 'Duplicate',
  OUT_OF_SCOPE: 'Out of scope',
  LOW_EFFORT: 'Low effort',
};

export const KIND_LABEL: Record<Kind, string> = { bug: 'Bug', usability: 'Usability', idea: 'Idea' };

/** What each verdict does with the stake and the reward, in the site's words. */
export const OUTCOME: Record<Exclude<Status, 'FILED'>, (stake: string, reward: string) => string> = {
  ACTIONABLE: (stake, reward) => `${stake} back plus ${reward}`,
  DUPLICATE: (stake) => `${stake} back, linked to the report it repeats`,
  OUT_OF_SCOPE: (stake) => `${stake} back`,
  LOW_EFFORT: (stake) => `${stake} to the pool`,
};

/** The filters on a program's record, in the order the spec draws them. */
export const FILTERS: { status: Status; label: string }[] = [
  { status: 'ACTIONABLE', label: 'Queue' },
  { status: 'DUPLICATE', label: 'Duplicates' },
  { status: 'OUT_OF_SCOPE', label: 'Out of scope' },
  { status: 'LOW_EFFORT', label: 'Low effort' },
  { status: 'FILED', label: 'Waiting' },
];

export const WEEK = 7 * 86400;

/** The week the contract counts a report against: seconds since the epoch // one week. */
export function weekOf(seconds: number): number {
  return Math.floor(seconds / WEEK);
}
