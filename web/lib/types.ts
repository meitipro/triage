/** The JSON the contract's views return. Field names are the contract's own. */

export type Verdict = 'ACTIONABLE' | 'DUPLICATE' | 'OUT_OF_SCOPE' | 'LOW_EFFORT';
export type Status = 'FILED' | Verdict;
export type Kind = 'bug' | 'usability' | 'idea';

export type Funding = { n: number; funder: string; amount: string; at: number };

export type NotFound = { found: false; programs?: number; reports_total?: number };

export type Program = {
  found: true;
  id: number;
  programs: number;
  reports_total: number;
  name: string;
  team: string;
  scope: string;
  reward: string;
  stake: string;
  weekly_cap: number;
  days: number;
  trial: boolean;
  created_at: number;
  ends_at: number;
  pool: string;
  reserved: string;
  funded: string;
  fundings: number;
  lost: string;
  paid: string;
  bonuses: string;
  returned: string;
  reports: number;
  judged: number;
  waiting: number;
  actionable: number;
  duplicate: number;
  out_of_scope: number;
  low_effort: number;
  testers: number;
  closed: boolean;
  closed_at: number;
  funding_log: Funding[];
  next_to_judge: number;
};

export type ReportRow = {
  id: number;
  program_id: number;
  index: number;
  tester: string;
  kind: Kind;
  title: string;
  status: Status;
  duplicate_of: number;
  summary: string;
  reason: string;
  stake: string;
  reward: string;
  credited: string;
  bonus: string;
  bonus_count: number;
  week: number;
  filed_at: number;
  judged_at: number;
  judged_by: string;
  /** Present on get_report and on the ACTIONABLE queue. */
  body?: string;
};

export type Report = ReportRow & {
  found: true;
  body: string;
  program_name: string;
  team: string;
  duplicate_title: string;
  next_to_judge: number;
};

export type ReportPage = {
  found: boolean;
  program_id?: number;
  status?: string;
  total: number;
  offset: number;
  items: ReportRow[];
};

export type TesterStats = {
  found: boolean;
  address: string;
  balance: string;
  filed: number;
  judged: number;
  actionable: number;
  duplicate: number;
  out_of_scope: number;
  low_effort: number;
  staked: string;
  lost: string;
  earned: string;
  withdrawn: string;
  items: ReportRow[];
};
