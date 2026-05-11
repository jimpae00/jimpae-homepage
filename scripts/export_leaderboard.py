#!/usr/bin/env python3
from __future__ import annotations
import json, sqlite3, time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = Path('/home/deck/stream-pc/StreamChat/leaderboard.db')
OUT = ROOT / 'assets' / 'leaderboard.json'

conn = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
conn.row_factory = sqlite3.Row
rows = conn.execute('''
    SELECT name, userName, points, platform
    FROM leaderboard
    ORDER BY points DESC, name COLLATE NOCASE ASC
''').fetchall()
conn.close()

entries = []
for rank, row in enumerate(rows, 1):
    name = (row['name'] or row['userName'] or '').strip()
    username = (row['userName'] or '').strip()
    platform = (row['platform'] or '').strip().lower()
    points = int(row['points'] or 0)
    if not name and not username:
        continue
    entries.append({
        'rank': rank,
        'name': name or username,
        'username': username or name,
        'points': points,
        'platform': 'YouTube' if platform == 'youtube' else 'Twitch' if platform == 'twitch' else platform.title(),
    })

payload = {
    'updatedAt': datetime.now(timezone.utc).isoformat(),
    'sourceMtime': DB.stat().st_mtime,
    'total': len(entries),
    'entries': entries,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
tmp = OUT.with_suffix('.json.tmp')
tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
tmp.replace(OUT)
print(json.dumps({'output': str(OUT), 'total': len(entries), 'top3': entries[:3]}, ensure_ascii=False, indent=2))
