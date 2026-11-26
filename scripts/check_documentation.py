"""Check local Markdown links without opening private documents or external URLs."""
from pathlib import Path
import re
import sys
from urllib.parse import unquote

root = Path(__file__).resolve().parents[1]
paths = [root / 'README.md', root / 'AGENTS.md', root / 'CONTRIBUTING.md', root / 'packages/core/README.md']
paths += list((root / 'docs').rglob('*.md'))
failures = []
for path in paths:
    if not path.exists():
        failures.append(f'{path.relative_to(root)} is missing')
        continue
    text = path.read_text('utf-8')
    for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', text):
        target = target.split('#', 1)[0]
        if not target or ':' in target:
            continue
        resolved = (path.parent / unquote(target)).resolve()
        if not resolved.is_relative_to(root) or not resolved.exists():
            failures.append(f'{path.relative_to(root)}: unresolved local link {target}')
if failures:
    print('\n'.join(failures), file=sys.stderr)
    raise SystemExit(1)
print(f'Local documentation links passed ({len(paths)} guides).')
