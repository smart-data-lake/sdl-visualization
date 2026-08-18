#!/usr/bin/env python3
"""
Marks the timestamps of the state fixtures as UTC.

Older SDLB runs (getting-started run 24) wrote local time without a zone, newer runs
(73-75) write an ISO timestamp ending in Z. Without a zone the browser parses the value
in its own timezone, so the fixture denotes a different instant depending on where the
tests run, and the two generations of state file disagree about what their timestamps
mean. Those runs executed on a GitHub runner, whose local time is UTC, so appending Z
states what the value always was.

Fractional second precision is left alone: run 24 has nanoseconds, newer runs have
milliseconds, and both parse fine. Idempotent, timestamps that already carry a zone are
not touched.

Usage: normalize-timestamps.py <file> [<file> ...]
"""
import re
import sys

# an ISO date-time that is the complete JSON string value, with no Z and no +hh:mm offset
TIMESTAMP = re.compile(r'"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)"')


def normalize(path: str) -> int:
    with open(path) as f:
        content = f.read()
    patched, count = TIMESTAMP.subn(r'"\1Z"', content)
    if count:
        with open(path, 'w') as f:
            f.write(patched)
    return count


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    for path in sys.argv[1:]:
        changed = normalize(path)
        print(f"{path}: {changed} timestamp(s) marked as UTC")
