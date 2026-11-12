"""Run the real Windows bootstrap under Restricted without altering host policy."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from windows_bootstrap import windows_command, administrator_command


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def windows_environment():
    # Actions launches Python from PowerShell 7. Its inherited module directory
    # points at Core-only assemblies that Windows PowerShell 5.1 cannot load.
    # Let the child initialize its own normal module paths, as Explorer does.
    return {key: value for key, value in os.environ.items() if key.lower() != 'psmodulepath'}


def bootstrap_process(product, options=(), installer=None, command=None, setup='', policy='Restricted'):
    route = 'r' if product == 'redagent' else 'v'
    installer = Path(installer or ROOT / f'static/{route}/install.ps1')
    arguments = ' '.join(str(x) if str(x).startswith('-') else quote(x) for x in options)
    command = command or windows_command(product, installer.read_bytes(), arguments)
    # Only the bootstrap's source download is replaced with a local fixture.
    # Archive/component downloads still exercise the real network installer.
    source = r'''
$ErrorActionPreference='Stop'
$before = Get-ExecutionPolicy -List | ConvertTo-Json -Compress
if ((Get-ExecutionPolicy) -ne $env:ORBITUS_TEST_POLICY) { throw 'Test policy was not applied' }
function Invoke-WebRequest {
    [CmdletBinding()]
    param([string]$Uri, [switch]$UseBasicParsing, [string]$OutFile,
          [int]$TimeoutSec, [hashtable]$Headers)
    if ($Uri -eq $env:ORBITUS_TEST_URL) {
        [IO.File]::Copy($env:ORBITUS_TEST_INSTALLER, $OutFile)
    } elseif ($Uri -eq 'https://www.orbitusrobotics.com/v/windows-startup.mjs') {
        [IO.File]::Copy($env:ORBITUS_TEST_STARTUP, $OutFile)
    } else { Microsoft.PowerShell.Utility\Invoke-WebRequest @PSBoundParameters }
}
try {
'''
    source += setup + '\n' + command
    source += r'''
} finally {
    # Remove only test mocks before comparing actual execution-policy scopes.
    Remove-Item Function:\Get-ExecutionPolicy -ErrorAction SilentlyContinue
    $after = Get-ExecutionPolicy -List | ConvertTo-Json -Compress
    if ($before -ne $after) { throw 'Installer changed execution policy' }
    Write-Host 'POLICY_UNCHANGED'
}
'''
    env = dict(windows_environment(), ORBITUS_TEST_INSTALLER=str(installer),
               ORBITUS_TEST_URL=f'https://www.orbitusrobotics.com/{route}/install.ps1',
               ORBITUS_TEST_STARTUP=str(ROOT / 'static/v/windows-startup.mjs'),
               ORBITUS_TEST_POLICY=policy)
    # This test only sets a restrictive policy for its child PowerShell process.
    # The generated installer never sets policy at any scope.
    return subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-ExecutionPolicy', policy,
                           '-Command', source], env=env, text=True, capture_output=True, timeout=240)


def assert_published_commands():
    for product, route in [('redagent', 'r'), ('viperlink', 'v')]:
        installer = (ROOT / f'static/{route}/install.ps1').read_bytes()
        entries = json.loads((ROOT / f'data/{product}_commands.json').read_text())
        for entry in entries:
            if entry['id'] != 'windows':
                continue
            options = '-Component ' + entry['component'] if product == 'viperlink' else ''
            assert entry['command'] == windows_command(product, installer, options)
            assert hashlib.sha256(installer).hexdigest() in entry['command']
            if entry.get('adminCommand'):
                assert entry['adminCommand'] == administrator_command(product, installer, options)
