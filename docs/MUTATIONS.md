# Mutations

Written by `python scripts/mutate.py --table docs/MUTATIONS.md`. 85 defences in
`contracts/triage.py` were each broken on their own, and every mutant was caught. Each row
names the first test that failed against it, read from pytest's report rather than an exit code.
The generated-copy and deployed-record tests are excluded, because they fail for any edit at all.

| # | defence broken | caught by |
|---|---|---|
| 1 | team check: anyone passes | `tests/test_direct.py::test_bonus_refusals` |
| 2 | bonus: no team check | `tests/test_direct.py::test_bonus_refusals` |
| 3 | close: no team check | `tests/test_direct.py::test_only_the_team_closes` |
| 4 | open: the program is recorded as nobody's | `tests/test_direct.py::test_open_program_records_the_terms_and_the_first_funding` |
| 5 | fund: the funder is not recorded | `tests/test_direct.py::test_open_program_records_the_terms_and_the_first_funding` |
| 6 | judge: the caller is not recorded | `tests/test_direct.py::test_actionable_pays_the_stake_back_plus_the_reward` |
| 7 | submit: the team files in its own program | `tests/test_direct.py::test_the_team_cannot_file_in_its_own_program` |
| 8 | submit: the team compared as case-sensitive text | `tests/test_direct.py::test_the_team_cannot_file_in_its_own_program` |
| 9 | submit: the report is recorded as nobody's | `tests/test_direct.py::test_submit_takes_the_stake_and_reserves_one_reward` |
| 10 | withdraw: pays a fixed address | `tests/test_direct.py::test_withdraw_pays_the_caller_their_whole_balance` |
| 11 | close: pays a fixed address | `tests/test_direct.py::test_close_returns_the_unused_pool_after_the_end` |
| 12 | open: no funding needed | `tests/test_direct.py::test_open_program_refuses_bad_terms[kwargs13-at` |
| 13 | open: a reward of zero | `tests/test_direct.py::test_open_program_refuses_bad_terms[kwargs5-the` |
| 14 | open: a stake of zero | `tests/test_direct.py::test_open_program_refuses_bad_terms[kwargs6-the` |
| 15 | open: a weekly cap of 21 | `tests/test_direct.py::test_open_program_refuses_bad_terms[kwargs7-between` |
| 16 | open: a scope of 1201 characters | `tests/test_direct.py::test_open_program_refuses_bad_terms[kwargs4-longer` |
| 17 | open: 121 days | `tests/test_direct.py::test_open_program_refuses_bad_terms[kwargs9-between` |
| 18 | open: the trial lasts two hours | `tests/test_direct.py::test_days_zero_is_a_one_hour_trial` |
| 19 | open: days measured in hours | `tests/test_direct.py::test_open_program_records_the_terms_and_the_first_funding` |
| 20 | whole numbers: a bool passes | `tests/test_direct.py::test_open_program_refuses_bad_terms[kwargs11-the` |
| 21 | fund: zero value accepted | `tests/test_direct.py::test_fund_refuses_nothing_an_ended_or_closed_program` |
| 22 | fund: open on a closed program | `tests/test_direct.py::test_fund_refuses_nothing_an_ended_or_closed_program` |
| 23 | fund: open after the end | `tests/test_direct.py::test_fund_refuses_nothing_an_ended_or_closed_program` |
| 24 | submit: any value is a stake | `tests/test_direct.py::test_submit_wants_exactly_the_stake[1000000000000000001]` |
| 25 | submit: no stake needed | `tests/test_direct.py::test_submit_wants_exactly_the_stake[0]` |
| 26 | submit: no weekly cap | `tests/test_direct.py::test_the_weekly_cap_counts_per_tester_per_program_per_week` |
| 27 | submit: the cap allows one more | `tests/test_direct.py::test_the_weekly_cap_counts_per_tester_per_program_per_week` |
| 28 | submit: the cap is per tester across programs | `tests/test_direct.py::test_the_weekly_cap_counts_per_tester_per_program_per_week` |
| 29 | submit: the cap never resets | `tests/test_direct.py::test_submit_takes_the_stake_and_reserves_one_reward` |
| 30 | submit: the count is not kept | `tests/test_direct.py::test_the_weekly_cap_counts_per_tester_per_program_per_week` |
| 31 | submit: no pool check | `tests/test_direct.py::test_a_report_is_never_filed_against_an_empty_pool` |
| 32 | submit: nothing is reserved | `tests/test_direct.py::test_submit_takes_the_stake_and_reserves_one_reward` |
| 33 | submit: the pool is not drawn down | `tests/test_direct.py::test_submit_takes_the_stake_and_reserves_one_reward` |
| 34 | submit: open after the end | `tests/test_direct.py::test_submit_refuses_after_the_end_and_after_close` |
| 35 | submit: open on a closed program | `tests/test_direct.py::test_submit_refuses_after_the_end_and_after_close` |
| 36 | submit: any kind | `tests/test_direct.py::test_submit_refuses_a_malformed_report[kwargs0-a` |
| 37 | submit: a 101-character title | `tests/test_direct.py::test_submit_refuses_a_malformed_report[kwargs3-longer` |
| 38 | submit: a 1501-character report | `tests/test_direct.py::test_submit_refuses_a_malformed_report[kwargs6-longer` |
| 39 | submit: testers counted on every report | `tests/test_direct.py::test_testers_are_counted_once_per_program` |
| 40 | submit: the tester's list is not kept | `tests/test_direct.py::test_actionable_pays_the_stake_back_plus_the_reward` |
| 41 | judge: a report is judged twice | `tests/test_direct.py::test_a_report_is_judged_once` |
| 42 | judge: out of filing order | `tests/test_direct.py::test_reports_are_judged_in_filing_order` |
| 43 | judge: the judged count is not kept | `tests/test_direct.py::test_submit_refuses_after_the_end_and_after_close` |
| 44 | judge: the reserve is kept | `tests/test_direct.py::test_actionable_pays_the_stake_back_plus_the_reward` |
| 45 | judge: ACTIONABLE credits only the stake | `tests/test_direct.py::test_actionable_pays_the_stake_back_plus_the_reward` |
| 46 | judge: ACTIONABLE keeps the stake | `tests/test_direct.py::test_actionable_pays_the_stake_back_plus_the_reward` |
| 47 | judge: ACTIONABLE does not join the queue | `tests/test_direct.py::test_duplicate_pays_the_stake_back_and_links_the_original` |
| 48 | judge: ACTIONABLE is not counted as paid | `tests/test_direct.py::test_actionable_pays_the_stake_back_plus_the_reward` |
| 49 | judge: LOW_EFFORT returns the stake | `tests/test_direct.py::test_low_effort_loses_the_stake_to_the_pool` |
| 50 | judge: LOW_EFFORT does not unreserve the reward | `tests/test_direct.py::test_low_effort_loses_the_stake_to_the_pool` |
| 51 | judge: LOW_EFFORT loses nothing on the record | `tests/test_direct.py::test_low_effort_loses_the_stake_to_the_pool` |
| 52 | judge: DUPLICATE and OUT_OF_SCOPE keep the stake | `tests/test_direct.py::test_duplicate_pays_the_stake_back_and_links_the_original` |
| 53 | judge: DUPLICATE and OUT_OF_SCOPE do not unreserve the reward | `tests/test_direct.py::test_duplicate_pays_the_stake_back_and_links_the_original` |
| 54 | judge: DUPLICATE pays the reward | `tests/test_direct.py::test_duplicate_pays_the_stake_back_and_links_the_original` |
| 55 | judge: the duplicate link is dropped | `tests/test_direct.py::test_duplicate_pays_the_stake_back_and_links_the_original` |
| 56 | judge: validators agree with any answer | `tests/test_direct.py::test_validators_compare_the_verdict` |
| 57 | judge: validators ignore the duplicate id | `tests/test_direct.py::test_validators_compare_the_duplicate_id` |
| 58 | judge: validators compare the summary too | `tests/test_direct.py::test_validators_never_compare_the_summary_or_the_reason` |
| 59 | judge: a duplicate may name any id | `tests/test_direct.py::test_the_judge_sees_the_last_25_accepted_reports` |
| 60 | judge: a duplicate id may be empty | `tests/test_direct.py::test_a_duplicate_must_name_an_accepted_report_the_judge_was_shown` |
| 61 | judge: an id on another label is kept | `tests/test_direct.py::test_submit_refuses_after_the_end_and_after_close` |
| 62 | judge: an unreadable verdict defaults to LOW_EFFORT | `tests/test_direct.py::test_an_unknown_label_is_never_turned_into_a_verdict` |
| 63 | judge: the summary is not capped | `tests/test_direct.py::test_summary_and_reason_are_cut_to_one_line` |
| 64 | judge: the reason is not capped | `tests/test_direct.py::test_summary_and_reason_are_cut_to_one_line` |
| 65 | judge: no retry on a formatting slip | `tests/test_direct.py::test_a_formatting_slip_gets_one_retry` |
| 66 | judge: 26 accepted reports shown | `tests/test_direct.py::test_the_judge_sees_the_last_25_accepted_reports` |
| 67 | judge: the oldest accepted reports shown | `tests/test_direct.py::test_the_judge_sees_the_last_25_accepted_reports` |
| 68 | prompt: the fence lets delimiters through | `tests/test_direct.py::test_the_report_text_is_stored_as_written` |
| 69 | prompt: the scope reaches the prompt unfenced | `tests/test_static.py::test_every_prompt_value_is_fenced_or_owned_by_the_contract` |
| 70 | prompt: the title reaches the prompt unfenced | `tests/test_static.py::test_every_prompt_value_is_fenced_or_owned_by_the_contract` |
| 71 | prompt: the body reaches the prompt unfenced | `tests/test_direct.py::test_the_report_text_is_stored_as_written` |
| 72 | prompt: accepted titles reach the prompt unfenced | `tests/test_static.py::test_accepted_lines_fence_every_title_and_summary` |
| 73 | prompt: accepted summaries reach the prompt unfenced | `tests/test_static.py::test_accepted_lines_fence_every_title_and_summary` |
| 74 | bonus: any report can be tipped | `tests/test_direct.py::test_bonus_refusals` |
| 75 | bonus: zero accepted | `tests/test_direct.py::test_bonus_refusals` |
| 76 | bonus: not credited | `tests/test_direct.py::test_the_team_tips_an_actionable_report` |
| 77 | withdraw: the balance is not cleared | `tests/test_direct.py::test_withdraw_pays_the_caller_their_whole_balance` |
| 78 | withdraw: a zero balance still sends | `tests/test_direct.py::test_withdraw_pays_the_caller_their_whole_balance` |
| 79 | close: before the end | `tests/test_direct.py::test_close_returns_the_unused_pool_after_the_end` |
| 80 | close: with reports waiting | `tests/test_direct.py::test_close_waits_for_every_filed_report` |
| 81 | close: closes twice | `tests/test_direct.py::test_close_returns_the_unused_pool_after_the_end` |
| 82 | close: the pool is not emptied | `tests/test_direct.py::test_close_returns_the_unused_pool_after_the_end` |
| 83 | close: the program stays open | `tests/test_direct.py::test_fund_refuses_nothing_an_ended_or_closed_program` |
| 84 | views: the queue pages from the wrong end | `tests/test_direct.py::test_list_reports_filters_and_pages_newest_first` |
| 85 | views: program 0 shows nothing | `tests/test_direct.py::test_program_zero_lists_every_program` |
