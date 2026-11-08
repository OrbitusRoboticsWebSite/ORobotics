#!/usr/bin/env python3
"""Install real pinned bundles into temporary directories; no app/test is launched."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
release = json.loads((ROOT / 'data/redagent_release.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--archive', type=Path)
args = parser.parse_args()
system = platform.system()
machine = platform.machine()
asset = next(a for a in release['assets'] if (a['system'], a['machine'].lower()) == (system, machine.lower()))
with tempfile.TemporaryDirectory(prefix='redagent-installer-test-') as scratch:
    work = Path(scratch)
    if args.archive:
        archive = args.archive.resolve()
    else:
        archive = work / asset['filename']
        urllib.request.urlretrieve(f"{release['downloadBase']}/{asset['filename']}", archive)
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == asset['sha256']
    dest = work / 'install with spaces'
    if system == 'Windows':
        shell = shutil.which('powershell.exe') or shutil.which('pwsh')
        # Execute under the runner's normal policy, with no policy override.
        base = [shell, '-NoProfile', '-File', str(ROOT / 'static/r/install.ps1')]
        prefix_flag, archive_flag, dry_flag = '-InstallDir', '-ArchivePath', '-DryRun'
        exe_relative = Path('RedAgent/RedAgent.exe')
    else:
        base = ['sh', str(ROOT / 'static/r/install.sh')]
        prefix_flag, archive_flag, dry_flag = '--prefix', '--archive', '--dry-run'
        exe_relative = Path('RedAgent.app/Contents/MacOS/RedAgent' if system == 'Darwin' else 'RedAgent/RedAgent')
    def run(destination=dest, bundle=archive, flags=(), succeeds=True):
        result = subprocess.run(base + [prefix_flag, str(destination), archive_flag, str(bundle), *flags], text=True, capture_output=True)
        assert (result.returncode == 0) == succeeds, result.stdout + result.stderr
        return result.stdout + result.stderr
    run(flags=[dry_flag])
    assert not dest.exists(), 'Dry run wrote an installation'
    damaged = work / ('damaged.zip' if system == 'Windows' else 'damaged.tar.gz')
    damaged.write_bytes(b'not the signed-off release bundle')
    assert 'SHA-256 mismatch' in run(bundle=damaged, succeeds=False)
    assert not dest.exists(), 'Hash mismatch wrote an installation'
    collision = work / 'unmanaged'
    collision.mkdir()
    (collision / 'keep.txt').write_text('existing user data')
    run(destination=collision, succeeds=False)
    assert (collision / 'keep.txt').read_text() == 'existing user data'
    run()
    receipt = json.loads((dest / 'installation.json').read_text(encoding='utf-8-sig'))
    assert receipt['archiveSHA256'] == asset['sha256']
    assert receipt['mdmEnrolled'] is False
    assert (dest / exe_relative).is_file()
    # Verify every installed application file against the source build receipt.
    build_receipt = json.loads((dest / 'receipt.json').read_text())
    for relative, expected in build_receipt['files'].items():
        installed = dest / relative.replace('\\', '/')
        assert hashlib.sha256(installed.read_bytes()).hexdigest() == expected, relative
    assert 'already installed' in run()
    assert not list(work.glob('install with spaces.backup.*'))
    # Simulate an interrupted previous install. Repair retains the old directory.
    (dest / exe_relative).unlink()
    (dest / 'keep-evidence.txt').write_text('prior data')
    run()
    backups = list(work.glob('install with spaces.backup.*'))
    assert len(backups) == 1
    assert (backups[0] / 'keep-evidence.txt').read_text() == 'prior data'
    assert (dest / exe_relative).is_file()
    assert not list(work.glob('.redagent-install*')), 'Temporary install data was left behind'
    print(json.dumps({'platform': system, 'machine': machine, 'version': release['version'], 'verifiedFiles': len(build_receipt['files']), 'checks': ['preview', 'hash rejection', 'unmanaged collision', 'install', 'file integrity', 'idempotence', 'repair backup', 'cleanup'], 'appLaunched': False}))
