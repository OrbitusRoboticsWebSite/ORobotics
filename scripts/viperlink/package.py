#!/usr/bin/env python3
"""Snapshot public source from one committed ViperLink revision, never local profiles."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, type=Path)
parser.add_argument('--commit', required=True)
args = parser.parse_args()
commit = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', args.commit + '^{commit}'], text=True).strip()
version = '0.3.0'
components = [
    {'id': 'cloud', 'name': 'Cloud Fleet commands', 'role': 'Execution target', 'runtime': 'Node.js 22+',
     'description': 'Receive ordered commands and file transfers over outbound HTTPS. Works beyond the local network.',
     'entry': 'queue-agent.mjs', 'files': ['cloudkit.mjs', 'report-direct.mjs', 'queue-format.mjs', 'queue-cloud.mjs', 'queue-agent.mjs'],
     'start': '''CLOUD FLEET COMMAND RECEIVER
1. Install Node.js 22+ separately if it is not already on the machine.
2. Have your administrator enroll this machine using the existing Fleet tools:
   https://www.orbitusrobotics.com/viper-fleet/
   Download the full reporter toolkit there and follow COMMANDS.md.
   Enrollment needs a registered CloudKit reporting key and a new per-machine
   command key. Keep receiver.json and fleet-private.pem in a private folder
   outside this installation and outside Git. On Unix use mode 700 for that
   folder and 600 for these files. On Windows use a user-only folder ACL.
3. Review receiver.json locally. Set root to this machine's absolute shared
   directory and create that directory without symlinks. Set intervalMinutes
   to 1-1440 (default 5). Set enabled to true only when ready to accept commands.
4. In this installed component directory run:
   node queue-agent.mjs --profile /absolute/private/receiver.json --once
   Or, for repeated check-ins while the terminal stays open:
   node queue-agent.mjs --profile /absolute/private/receiver.json --watch
   On Windows replace the profile path with a quoted absolute Windows path.
5. Ctrl+C stops the foreground process. Set enabled=false in the private
   profile to keep it disabled on future starts. No service or login item is
   installed. Do not run a second receiver against a profile RedAgent owns.

Commands execute with this account's normal permissions. Check-ins report host
and OS status; this kit does not collect application inventory. The cloud
transport credential is shared and can access other fleet records; enroll only
trusted managed machines. Each machine's separate command key authenticates
and encrypts its jobs. Queue acceptance is not proof of execution: verify the
authenticated receipt in ViperLink or the Fleet portal. Production CloudKit
activation is separate from this development pilot.
'''},
    {'id': 'status', 'name': 'Status reporting only', 'role': 'Reporting client', 'runtime': 'Node.js 22+',
     'description': 'Send a status JSON file that you prepare. The command receiver is omitted from this package.',
     'entry': 'report-direct.mjs', 'files': ['cloudkit.mjs', 'report-direct.mjs'],
     'start': '''STATUS REPORTING CLIENT
1. Install Node.js 22+ separately if needed.
2. Follow the reporter README and private key registration instructions at:
   https://www.orbitusrobotics.com/viper-fleet/
3. Keep reporter-profile.json and fleet-private.pem in a private folder outside
   the installation and Git. Use 700/600 permissions on Unix, or a user-only
   folder ACL on Windows. This is a shared transport key with fleet record
   access, not a write-only credential. Provision only trusted managed devices.
4. Prepare status.json with truthful values using the example in that README.
   This tool sends only your supplied JSON; it does not inventory this machine.
5. From this installed component directory, validate locally without sending:
   node report-direct.mjs --profile /absolute/private/reporter-profile.json --report /absolute/status.json --validate
   Then send the report deliberately by omitting --validate.
   Use quoted absolute Windows paths on Windows.
6. The process exits after one report. No scheduler is installed. This package
   has no command-receiver module; do not treat file selection as an OS sandbox.
'''},
    {'id': 'lan', 'name': 'LAN / VPN controller', 'role': 'Controller only', 'runtime': 'Python 3.10+ / OpenSSL TLS 1.3',
     'description': 'Connect to an existing ViperLink host with a private device profile. Send commands and files from this computer.',
     'entry': 'viperlink.py', 'files': ['viperlink.py'],
     'start': '''LAN / VPN CONTROLLER
1. Install Python 3.10+ with OpenSSL TLS 1.3. Apple's older system Python with
   LibreSSL is insufficient. Use python.org or your approved package manager.
2. An administrator must start an existing native ViperLink host and provision
   a unique controller profile. The native host/agent currently requires macOS;
   it is not included here. No NAT traversal or public Internet relay is added.
3. Transfer that profile privately to this controller. Keep it outside this
   install and Git. It grants access to the host's registered execution targets.
4. From this directory inspect the command help, then list the host's clients:
   python3 viperlink.py --help
   python3 viperlink.py --profile /absolute/private/controller.json clients
   On Windows use python and a quoted absolute Windows profile path.
5. Select the intended target explicitly for operations. The certificate is
   pinned and each device authenticates with its own secret. Revoke profiles at
   the host when access should end.

This is a controller, not a Windows/Linux execution agent or a background
service. The Python protocol client was tested against a Mac host on macOS;
physical Windows/Linux LAN interoperability needs separate field validation.
Use the Cloud Fleet commands component when this computer should receive jobs.
'''}
]
release = {'version': version, 'date': '2026-11-11', 'channel': 'source-development-pilot',
           'sourceRepository': 'https://github.com/RudyAramayo/EndpointExecutionMonitor', 'sourceCommit': commit,
           'bundlesRuntime': False, 'containsCredentials': False, 'installsService': False, 'components': []}
for component in components:
    component = dict(component)
    payload = {}
    for name in component.pop('files'):
        relative = 'ViperLink/portable/viperlink.py' if name == 'viperlink.py' else 'ViperLink/Fleet/' + name
        payload[name] = subprocess.check_output(['git', '-C', str(args.source), 'show', f'{commit}:{relative}'])
    payload['START.txt'] = (f"ViperLink {version} source development pilot\nSource: {commit}\n\n" + component.pop('start') + '''
INSTALLATION AND REMOVAL
Public packages contain source and these instructions only. No runtime, GUI,
credentials, test suite, security policy change, or automatic startup is bundled.
Keep private profiles separate. To remove this component, stop its foreground
process and remove only its versioned installation directory. Revoke/rotate
private credentials separately; deleting source files does not revoke access.
The installer preserves other components and older versions. Read installation.txt
for the managed-install receipt. Re-running the installer verifies each file.
''').encode()
    folder = ROOT / 'static/v/packages' / version / component['id']
    folder.mkdir(parents=True, exist_ok=True)
    entries = []
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for name, data in payload.items():
            (folder / name).write_bytes(data)
            entries.append({'name': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            info = zipfile.ZipInfo(name, (2026, 11, 11, 0, 0, 0))
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            bundle.writestr(info, data)
    filename = f"ViperLink-{component['id']}-{version}.zip"
    (folder.parent / filename).write_bytes(archive.getvalue())
    component.update(files=entries, installedBytes=sum(x['bytes'] for x in entries),
                     archiveBytes=len(archive.getvalue()), archiveSHA256=hashlib.sha256(archive.getvalue()).hexdigest(),
                     archive=filename)
    release['components'].append(component)
(ROOT / 'data/viperlink_release.json').write_bytes((json.dumps(release, indent=2) + '\n').encode())
print(json.dumps({c['id']: {'sourceBytes': c['installedBytes'], 'zipBytes': c['archiveBytes']} for c in release['components']}))
