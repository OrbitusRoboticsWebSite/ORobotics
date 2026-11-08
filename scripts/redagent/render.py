#!/usr/bin/env python3
"""Keep the portal, pinned installers, and Flipper commands on one release."""
import argparse
import json
from pathlib import Path
import re
import sys
import zipfile
import io

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
release = json.loads((ROOT / 'data/redagent_release.json').read_text())
base = release['downloadBase']
query = release['downloadQuery']
assert re.fullmatch(r'https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/redagent-v[0-9.]+-pilot', base)
assert re.fullmatch(r'\?download=1&release=[0-9.]+', query)
assert re.fullmatch(r'[0-9.]+', release['version'])
assert re.fullmatch(r'[a-f0-9]{40}', release['sourceCommit'])
replacements = {'VERSION': release['version'], 'SOURCE_COMMIT': release['sourceCommit'], 'BASE_URL': base, 'DOWNLOAD_QUERY': query}
unix_cases = []
for asset in release['assets']:
    assert re.fullmatch(r'[a-f0-9]{64}', asset['sha256'])
    assert re.fullmatch(r'RedAgent-[A-Za-z0-9_.-]+', asset['filename'])
    if asset['system'] == 'Windows':
        replacements.update(WINDOWS_SHA256=asset['sha256'], WINDOWS_FILENAME=asset['filename'])
    else:
        key = f"{asset['system']}/{asset['machine']}"
        assert key in ('Darwin/arm64', 'Darwin/x86_64', 'Linux/x86_64')
        exe = 'RedAgent.app/Contents/MacOS/RedAgent' if asset['system'] == 'Darwin' else 'RedAgent/RedAgent'
        unix_cases.append(f"    {key}) filename='{asset['filename']}'; expected='{asset['sha256']}'; executable='{exe}';;")
replacements['UNIX_ASSETS'] = '\n'.join(unix_cases)
files = {}
for name in ('install.sh', 'install.ps1'):
    template = (ROOT / 'scripts/redagent' / (name + '.in')).read_text()
    for key, value in replacements.items():
        template = template.replace('@' + key + '@', value)
    assert not re.search(r'@[A-Z_]+@', template)
    files['static/r/' + name] = template.encode()

unix = 'd=$(mktemp -d) && curl -fsSL --proto "=https" --proto-redir "=https" https://www.orbitusrobotics.com/r/install.sh -o "$d/install.sh" && sh "$d/install.sh"'
windows = "& { $p=Join-Path $env:TEMP ('redagent-'+[guid]::NewGuid()+'.ps1'); Invoke-WebRequest -UseBasicParsing https://www.orbitusrobotics.com/r/install.ps1 -OutFile $p -ErrorAction Stop; & $p }"
commands = [
    {'id': 'windows', 'label': 'Windows', 'terminal': 'PowerShell', 'architecture': 'x64', 'command': windows, 'script': 'r/install.ps1', 'requirements': 'Windows x64, PowerShell 5.1 or newer, and a device policy that permits this unsigned pilot script. Built and GUI-tested on Windows Server 2025; Windows 11 field validation remains pending.', 'location': '%LOCALAPPDATA%\\Programs\\Orbitus\\RedAgent', 'launch': 'Open RedAgent from the Start menu.'},
    {'id': 'macos', 'label': 'macOS', 'terminal': 'Terminal', 'architecture': 'Apple Silicon + Intel', 'command': unix, 'script': 'r/install.sh', 'requirements': 'Apple Silicon or Intel. The script chooses the native build, including under Rosetta. Built and GUI-tested on macOS 26 (Apple Silicon) and macOS 15 (Intel); older macOS compatibility is not yet established.', 'location': '~/Applications/RedAgent', 'launch': 'Open RedAgent.app inside the installation folder in Finder.'},
    {'id': 'linux', 'label': 'Linux', 'terminal': 'Terminal (sh/bash/zsh)', 'architecture': 'x86_64', 'command': unix, 'script': 'r/install.sh', 'requirements': 'x86_64 desktop Linux with glibc 2.35+, curl, tar, and X11 libraries. Built and GUI-tested on Ubuntu 22.04. No ARM Linux or musl/Alpine bundle is available.', 'location': '~/.local/share/RedAgent', 'launch': 'Run ~/.local/share/RedAgent/RedAgent/RedAgent in a graphical desktop session.'},
]
files['data/redagent_commands.json'] = (json.dumps(commands, indent=2) + '\n').encode()
files['static/r/release.json'] = (json.dumps(release, indent=2) + '\n').encode()
flipper_files = {}
for os_name, opener in {
    'windows': ['GUI r', 'DELAY 1200', 'STRING powershell.exe -NoLogo -NoProfile', 'ENTER', 'DELAY 4000'],
    'macos': ['GUI SPACE', 'DELAY 1200', 'STRING Terminal', 'ENTER', 'DELAY 4000', 'GUI n', 'DELAY 1500'],
    'linux': ['CTRL ALT t', 'DELAY 4000'],
}.items():
    command = next(item['command'] for item in commands if item['id'] == os_name)
    lines = [f'REM RedAgent {release["version"]} pilot installation - {os_name}',
             'REM Use on your unlocked corporate computer. Match the Flipper keyboard layout to the host.',
             'REM Linux requires Ctrl+Alt+T to open a terminal. macOS requires Cmd+Space for Spotlight.',
             'REM Leaves the terminal visible. Installs for this user; no elevation, tests, or MDM enrollment.',
             'DEFAULT_STRING_DELAY 10', 'DELAY 2000', *opener, 'STRING ' + command, 'ENTER']
    flipper_files[f'RedAgent-{os_name}.txt'] = ('\n'.join(lines) + '\n').encode('ascii')
readme = f'''RedAgent {release['version']} - Flipper Zero USB installation scripts

1. Copy the three .txt scripts to SD Card/badusb/ using qFlipper or the Flipper mobile app.
2. Close qFlipper. Unlock your corporate computer and select its OS script in Bad USB.
3. Choose USB mode and the keyboard layout that matches the computer.
4. Connect by USB, then press Run on the Flipper. Standard firmware requires this Run action.
5. Watch the visible terminal for "Installed RedAgent" or "already installed".

These scripts type the same commands shown at https://www.orbitusrobotics.com/r/.
They do not detect the host OS: select the Windows, macOS, or Linux script yourself.
The website recommends a platform; the installer independently detects architecture.
Linux uses Ctrl+Alt+T; configure that terminal shortcut first if your desktop lacks it.
macOS uses Spotlight (Cmd+Space) and opens a new Terminal window. First-time keyboard,
USB accessory, or system approval prompts may need your normal interaction. Increase
DELAY values if a slower machine is not ready before typing starts.

Internet access to www.orbitusrobotics.com and GitHub release assets is needed.
This is a development pilot without production signing/notarization. Managed device
policies may block scripts or unsigned apps; use your approved administration process.
The scripts do not change execution policy, disable security tools, enter passwords,
enroll in MDM, or start a test. Python/Tk are bundled; scanning tools are separate.
After installation open the GUI from the location printed by the installer.

Hardware execution on a Flipper has not yet been verified.
Official instructions: https://docs.flipper.net/zero/bad-usb
Script syntax: https://developer.flipper.net/flipperzero/doxygen/badusb_file_format.html
'''
flipper_files['README.txt'] = readme.encode()
for name, content in flipper_files.items():
    files['static/r/flipper/' + name] = content
archive = io.BytesIO()
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for name, content in flipper_files.items():
        info = zipfile.ZipInfo(name, (2026, 11, 8, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        bundle.writestr(info, content)
files['static/r/RedAgent-Flipper-scripts.zip'] = archive.getvalue()
stale = []
for relative, content in files.items():
    destination = ROOT / relative
    if args.check:
        if not destination.exists() or destination.read_bytes() != content: stale.append(relative)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
if stale:
    sys.exit('Regenerate RedAgent assets with python3 scripts/redagent/render.py: ' + ', '.join(stale))
print(f'{len(files)} RedAgent files {"verified" if args.check else "generated"}.')
