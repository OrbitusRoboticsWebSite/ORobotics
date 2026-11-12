#!/usr/bin/env python3
"""Package an allowlist of public Fleet toolkit source from a committed revision."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--commit', required=True)
args = parser.parse_args()
commit = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', args.commit+'^{commit}'], text=True).strip()
files = ['cloudkit.mjs', 'report-direct.mjs', 'setup-direct.mjs', 'direct.test.mjs', 'schema.ckdb', 'README.md',
         'queue-format.mjs', 'queue-cloud.mjs', 'queue-agent.mjs', 'queue-submit.mjs', 'enroll-commands.mjs',
         'queue.test.mjs', 'COMMANDS.md', 'enrollment-format.mjs', 'auto-enroll.mjs', 'make-bootstrap.mjs', 'enrollment.test.mjs']
version = '0.4.0'
manifest = {'version': version, 'filename': f'ViperFleet-Reporter-{version}.zip', 'sourceCommit': commit,
            'requires': 'Node.js 22 or later', 'containsCredentials': False, 'files': []}
archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name in files:
        data = subprocess.check_output(['git', '-C', str(args.source), 'show', f'{commit}:ViperLink/Fleet/{name}'])
        entry = zipfile.ZipInfo(name, (2026, 11, 11, 0, 0, 0))
        entry.create_system = 3; entry.compress_type = zipfile.ZIP_DEFLATED; entry.external_attr = 0o644 << 16
        bundle.writestr(entry, data)
        manifest['files'].append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
data = archive.getvalue(); manifest.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
destination = ROOT / 'static/viper-fleet'
(destination / manifest['filename']).write_bytes(data)
(destination / 'reporter-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(f'Packaged {len(files)} public source files from {commit}')
