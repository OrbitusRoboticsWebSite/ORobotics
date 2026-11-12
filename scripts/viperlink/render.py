#!/usr/bin/env python3
"""Generate installers, website commands and nine Flipper scripts from one manifest."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from windows_bootstrap import windows_command, administrator_command
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
release = json.loads((ROOT / 'data/viperlink_release.json').read_text())
assert re.fullmatch(r'[0-9.]+', release['version'])
assert re.fullmatch(r'[a-f0-9]{40}', release['sourceCommit'])
assert [c['id'] for c in release['components']] == ['cloud', 'status', 'lan']
file_map, cases = {}, []
for component in release['components']:
    folder = ROOT / 'static/v/packages' / release['version'] / component['id']
    for entry in component['files']:
        assert re.fullmatch(r'[A-Za-z0-9.-]+', entry['name'])
        data = (folder / entry['name']).read_bytes()
        assert len(data) == entry['bytes'] and hashlib.sha256(data).hexdigest() == entry['sha256']
    archive = (folder.parent / component['archive']).read_bytes()
    assert len(archive) == component['archiveBytes'] and hashlib.sha256(archive).hexdigest() == component['archiveSHA256']
    with zipfile.ZipFile(io.BytesIO(archive)) as bundle:
        assert set(bundle.namelist()) == {x['name'] for x in component['files']}
        for entry in component['files']:
            assert bundle.read(entry['name']) == (folder / entry['name']).read_bytes()
    assert sum(x['bytes'] for x in component['files']) == component['installedBytes']
    file_map[component['id']] = component['files']
    lines = '\n'.join(x['sha256'] + ' ' + x['name'] for x in component['files'])
    cases.append(f"        {component['id']}) cat <<'FILES'\n{lines}\nFILES\n            ;;")
replacements = {'VERSION': release['version'], 'SOURCE_COMMIT': release['sourceCommit'],
                'FILE_CASES': '\n'.join(cases), 'FILE_MAP': "@'\n" + json.dumps(file_map, indent=2) + "\n'@ | ConvertFrom-Json"}
runtime = json.loads((ROOT / 'data/viperlink_windows_runtime.json').read_text())
replacements['MACHINE_FUNCTIONS'] = (ROOT / 'scripts/viperlink/windows-machine.ps1.in').read_text()
for key, field in [('VERSION','version'),('URL','url'),('SHA256','sha256'),('FOLDER','folder'),('BINARY_SHA256','binarySHA256')]:
    replacements['NODE_' + key] = runtime[field]
replacements['STARTUP_SHA256'] = hashlib.sha256((ROOT / 'static/v/windows-startup.mjs').read_bytes()).hexdigest()
assert replacements['STARTUP_SHA256'] == release['windowsAdministrator']['startupSHA256']
outputs = {}
for filename in ['install.sh', 'install.ps1']:
    data = (ROOT / 'scripts/viperlink' / (filename + '.in')).read_text()
    for key, value in replacements.items(): data = data.replace('@' + key + '@', value)
    assert not re.search(r'@[A-Z_]+@', data)
    outputs['static/v/' + filename] = data.encode()
platforms = [
    {'id': 'windows', 'name': 'Windows', 'terminal': 'PowerShell 5.1+', 'script': 'install.ps1'},
    {'id': 'macos', 'name': 'macOS', 'terminal': 'Terminal', 'script': 'install.sh'},
    {'id': 'linux', 'name': 'Linux', 'terminal': 'Terminal', 'script': 'install.sh'}]
openers = {
    'windows': ['GUI r', 'DELAY 1200', 'STRING powershell.exe -NoLogo -NoProfile', 'ENTER', 'DELAY 4000'],
    'macos': ['GUI SPACE', 'DELAY 1200', 'STRING Terminal', 'ENTER', 'DELAY 4000', 'GUI n', 'DELAY 1500'],
    'linux': ['CTRL ALT t', 'DELAY 4000']}
commands, flipper = [], {}
for component in release['components']:
    for platform in platforms:
        mode = component['id']
        if platform['id'] == 'windows':
            command = windows_command('viperlink', outputs['static/v/install.ps1'], '-Component ' + mode)
        else:
            command = 'd=$(mktemp -d) && curl -fsSL --proto "=https" --proto-redir "=https" https://www.orbitusrobotics.com/v/install.sh -o "$d/install.sh" && sh "$d/install.sh" --component ' + mode
        filename = f"ViperLink-{mode}-{platform['id']}.txt"
        commands.append({**platform, 'component': mode, 'componentName': component['name'], 'command': command, 'flipper': filename})
        if platform['id'] == 'windows' and mode == 'cloud':
            commands[-1]['adminCommand'] = administrator_command('viperlink', outputs['static/v/install.ps1'], '-Component cloud')
            commands[-1]['adminFlipper'] = 'ViperLink-cloud-windows-admin.txt'
        lines = [f"REM ViperLink {release['version']} - {component['name']} - {platform['name']}",
                 'REM Use on your authorized, unlocked computer. Match its keyboard layout.',
                 'REM Installs public source only. Credentials and starting the tool are separate.',
                 'REM Visible terminal; no elevation, automatic service or policy changes.',
                 'DEFAULT_STRING_DELAY 10', 'DELAY 2000', *openers[platform['id']], 'STRING ' + command, 'ENTER']
        flipper[filename] = ('\n'.join(lines) + '\n').encode('ascii')
entry = next(c for c in commands if c.get('adminCommand'))
flipper[entry['adminFlipper']] = ('\n'.join([
    'REM ViperLink Cloud Windows administrator install: all users and a machine startup task.',
    'REM Use on your authorized unlocked computer. Match its keyboard layout.',
    'REM Approve the normal UAC prompt yourself. No approval or password is typed.',
    'REM Includes verified Node runtime. Runs as LocalService and waits for private enrollment.',
    'DEFAULT_STRING_DELAY 10', 'DELAY 2000', *openers['windows'],
    'STRING ' + entry['adminCommand'], 'ENTER']) + '\n').encode('ascii')
flipper['README.txt'] = '''ViperLink Flipper Zero install scripts
Select the component AND operating system in the filename.
cloud: Cloud Fleet command receiver; Node.js 22+ required.
status: Status JSON reporter only; Node.js 22+ required.
lan: LAN/VPN controller only; Python 3.10+ with OpenSSL TLS 1.3 required.

Windows Cloud Fleet has two choices:
- ViperLink-cloud-windows.txt: current user only, foreground receiver, Node.js
  22+ installed separately, no elevation or automatic startup.
- ViperLink-cloud-windows-admin.txt: normal UAC approval, protected Program Files
  installation for all users, verified private Node runtime, and the visible
  "Orbitus ViperLink Cloud" task in Task Scheduler. It runs as LocalService at
  boot before login, starts now, and waits for enrollment. It retries failures.
  Put private receiver.json and fleet-private.pem in
  %ProgramData%\Orbitus\ViperLink; use its Workspace as the shared root.
  Only the installing operator and administrators can provision credentials.
  Set enabled=true when ready. startup-status.json records the latest state.
  Keep only one receiver for an enrollment; stop the foreground receiver first.
  To stop automatic operation, disable the task, then end its running instance.
  To uninstall, delete that task and the Program Files installation. Preserve
  or revoke private enrollment separately; deleting files does not revoke keys.
The status reporter and LAN controller retain their user installation scripts.

Copy .txt scripts into SD Card/badusb/ using qFlipper or the mobile app.
Close qFlipper. Unlock your authorized computer. Choose the matching script,
USB mode and keyboard layout, connect the cable and press Run on the Flipper.
macOS uses Spotlight and Terminal; Linux assumes Ctrl+Alt+T opens a terminal.
Handle first-use keyboard, USB and OS prompts normally. Adjust delays if needed.
The visible terminal types exactly the command shown at:
https://www.orbitusrobotics.com/v/

Windows: replace older .txt files if you saw "running scripts is disabled".
The updated command verifies the installer SHA-256, then runs its contents as
visible console commands. It does not launch a .ps1 file or change execution policy.
It stops for configured Group Policy, AllSigned, or constrained language sessions;
use your administrator-approved distribution process on those machines.
If the installer checksum changes, download fresh Flipper scripts from the website.

The user scripts do not install startup tasks or start receivers. Their runtime
installation remains separate. The Windows Cloud administrator script installs
its runtime and startup task explicitly after UAC approval. No script alters
execution policy, enters passwords, enables commands or embeds credentials.
Normal managed-device policy applies to these unsigned source pilot scripts.
Physical Flipper execution and timing have not been verified.
https://docs.flipper.net/zero/bad-usb
https://developer.flipper.net/flipperzero/doxygen/badusb_file_format.html
'''.encode()
archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name, content in flipper.items():
        outputs['static/v/flipper/' + name] = content
        info = zipfile.ZipInfo(name, (2026, 11, 11, 0, 0, 0))
        info.create_system = 3
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        bundle.writestr(info, content)
outputs['static/v/ViperLink-Flipper-scripts.zip'] = archive.getvalue()
outputs['data/viperlink_commands.json'] = (json.dumps(commands, indent=2) + '\n').encode()
outputs['static/v/release.json'] = (json.dumps(release, indent=2) + '\n').encode()
outputs['static/v/windows-runtime.json'] = (json.dumps(runtime, indent=2) + '\n').encode()
manifest = {'product': 'ViperLink', 'packageVersion': release['version'], 'files': [
    {'path': name.removeprefix('static/'), 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()}
    for name, content in outputs.items() if name.startswith('static/')
]}
startup = (ROOT / 'static/v/windows-startup.mjs').read_bytes()
manifest['files'].append({'path': 'v/windows-startup.mjs', 'bytes': len(startup), 'sha256': hashlib.sha256(startup).hexdigest()})
outputs['static/v/installers.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
stale = []
for relative, content in outputs.items():
    path = ROOT / relative
    if args.check:
        if not path.exists() or path.read_bytes() != content: stale.append(relative)
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
if stale: sys.exit('Run python3 scripts/viperlink/render.py: ' + ', '.join(stale))
print(f'{len(outputs)} ViperLink files {"verified" if args.check else "generated"}; all package hashes match.')
