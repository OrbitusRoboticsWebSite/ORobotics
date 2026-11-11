#!/usr/bin/env python3
"""Verify deployed installer, source, ZIP and Flipper bytes against this checkout."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'https://www.orbitusrobotics.com/'


def fetch(relative):
    with urlopen(Request(ORIGIN + relative, headers={'User-Agent': 'Orbitus-release-verification'}), timeout=30) as response:
        assert response.status == 200, relative
        return response.read()


def verify(path):
    relative = path.relative_to(ROOT / 'static').as_posix()
    actual, expected = fetch(relative), path.read_bytes()
    assert hashlib.sha256(actual).digest() == hashlib.sha256(expected).digest(), f'Public bytes differ: {relative}'
    return relative


if __name__ == '__main__':
    files = sorted(p for p in (ROOT / 'static/v').rglob('*') if p.is_file())
    with ThreadPoolExecutor(max_workers=6) as pool:
        verified = list(pool.map(verify, files))
    page = fetch('v/').decode()
    assert 'Just the control you need.' in page and 'Download all 9 scripts' in page
    assert all(f'data-component={name}' in page or f'data-component="{name}"' in page for name in ['cloud', 'status', 'lan'])
    for alias in ['viperlink/', 'products/viperlink/']:
        assert 'https://www.orbitusrobotics.com/v/' in fetch(alias).decode(), alias
    for discovery in ['r/', 'products/']:
        assert 'https://www.orbitusrobotics.com/v/' in fetch(discovery).decode(), discovery
    print(f'Public ViperLink page, both aliases and both discovery links verified; {len(verified)} deployed files match SHA-256.')
