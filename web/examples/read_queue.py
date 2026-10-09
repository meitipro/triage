"""
Read a program's queue of actionable reports with genlayer-py, no wallet needed.

    python web/examples/read_queue.py <program id>

genlayer-py reads through an account, so a throwaway one is made and never
funded. This file is the sample on the docs page "Queue export for trackers",
copied in by scripts/gen_docs.py.
"""

import json
import sys

from genlayer_py import create_account, create_client
from genlayer_py.chains import studio_devnet

TRIAGE = "0x17c378994ebdF51ca536A8020dC04129F3612373"
studio_devnet.rpc_urls = {"default": {"http": ["https://studio-next.genlayer.com/api"]}}

program = int(sys.argv[1]) if len(sys.argv) > 1 else 1
client = create_client(chain=studio_devnet, account=create_account())
page = json.loads(client.read_contract(address=TRIAGE, function_name="list_reports", args=[program, "ACTIONABLE", 0, 50]))
for report in page["items"]:
    print(f"#{report['id']}  [{report['kind']}]  {report['title']}  ({report['summary']})")
print(f"{page['total']} actionable report(s) in program {program}")
