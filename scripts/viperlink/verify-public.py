#!/usr/bin/env python3
"""Verify both Flipper catalogs and their built or deployed downloads."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[2]
ORIGIN = 'https://www.orbitusrobotics.com/'


def fetch(relative, directory=None):
    if directory is not None:
        return (directory / relative / 'index.html' if relative.endswith('/') else directory / relative).read_bytes()
    with urlopen(Request(ORIGIN + relative, headers={'User-Agent': 'Orbitus-release-verification', 'Cache-Control': 'no-cache'}), timeout=30) as response:
        assert response.status == 200, relative
        return response.read()


def verify(path, directory=None):
    relative = path.relative_to(ROOT / 'static').as_posix()
    actual, expected = fetch(relative, directory), path.read_bytes()
    assert hashlib.sha256(actual).digest() == hashlib.sha256(expected).digest(), f'Public bytes differ: {relative}'
    return relative


class Links(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.paths = set()
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            href = dict(attrs).get('href', '')
            self.paths.add(urlsplit(href).path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, help='Validate a local Hugo build instead of the public website.')
    args = parser.parse_args()
    files = sorted(p for product in ('r', 'v') for p in (ROOT / 'static' / product).rglob('*') if p.is_file())
    with ThreadPoolExecutor(max_workers=6) as pool:
        verified = list(pool.map(lambda path: verify(path, args.directory), files))

    commands = json.loads((ROOT / 'data/viperlink_commands.json').read_text())
    viper_names = {c['flipper'] for c in commands} | {c['adminFlipper'] for c in commands if c.get('adminFlipper')}
    redagent_names = {p.name for p in (ROOT / 'static/r/flipper').glob('RedAgent-*.txt')}
    assert len(viper_names) == 10 and len(redagent_names) == 4
    viper_links = {'/v/flipper/' + name for name in viper_names} | {'/v/ViperLink-Flipper-scripts.zip', '/v/installers.json', '/v/flipper/README.txt'}
    redagent_links = {'/r/flipper/' + name for name in redagent_names} | {'/r/RedAgent-Flipper-scripts.zip', '/r/installers.json', '/r/flipper/README.txt'}
    for product, required in [('v', viper_links), ('r', viper_links | redagent_links)]:
        html = fetch(product + '/', args.directory).decode()
        missing = required - Links(html).paths
        assert not missing, f'/{product}/ is missing Flipper downloads: {sorted(missing)}'
        assert 'Download all 10 ViperLink scripts' in html, product

    for product, label, names in [('v', 'ViperLink', viper_names), ('r', 'RedAgent', redagent_names)]:
        archive = fetch(f'{product}/{label}-Flipper-scripts.zip', args.directory)
        with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
            assert set(bundle.namelist()) == names | {'README.txt'}
            for name in bundle.namelist():
                assert bundle.read(name) == fetch(f'{product}/flipper/{name}', args.directory), name

    page = fetch('v/', args.directory).decode()
    assert 'Just the control you need.' in page
    assert all(f'data-component={name}' in page or f'data-component="{name}"' in page for name in ['cloud', 'status', 'lan'])
    for alias in ['viperlink/', 'products/viperlink/']:
        assert 'https://www.orbitusrobotics.com/v/' in fetch(alias, args.directory).decode(), alias
    for discovery in ['r/', 'products/']:
        assert '/v/' in Links(fetch(discovery, args.directory).decode()).paths, discovery
    destination = 'Built' if args.directory is not None else 'Public'
    print(f'{destination} /r/ and /v/ catalogs expose all 10 ViperLink scripts; /r/ also exposes all 4 RedAgent scripts. Both ZIP contents and {len(verified)} files match this checkout.')
