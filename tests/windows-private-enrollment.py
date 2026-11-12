"""Exercise private input, installer integrity, cleanup and policy on Windows."""
import base64
import importlib.util
import json
import os
import re
from pathlib import Path
import tempfile

from windows_bootstrap_support import ROOT, bootstrap_process, quote

assert os.name == 'nt', 'Run on a disposable Windows CI host'
spec = importlib.util.spec_from_file_location('private_flipper', ROOT / 'scripts/viperlink/private-flipper.py')
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)
with tempfile.TemporaryDirectory(prefix='viper private input ') as temporary:
    folder = Path(temporary)
    installer = folder / 'fixture.ps1'
    capture = folder / 'capture.json'
    installer.write_text(r'''
param([string]$Component,[string]$Scope,[string]$ControlUser,[string]$EnrollmentFile)
$value=Get-Content -LiteralPath $EnrollmentFile -Raw | ConvertFrom-Json
if ($value.privateKeyPEM -ne 'UNREGISTERED-TEST-TRANSPORT-SECRET') { throw 'Private input was not transferred' }
if ($Component -ne 'cloud' -or $Scope -ne 'Machine' -or $ControlUser -notmatch '^S-1-') { throw 'Incorrect installation scope' }
@{path=$EnrollmentFile;scope=$Scope;component=$Component} | ConvertTo-Json | Set-Content -LiteralPath $env:ORBITUS_CAPTURE
''', encoding='utf-8')
    bootstrap = json.dumps({'version': 1, 'kind': 'viperlink-auto-enrollment',
                           'privateKeyPEM': 'UNREGISTERED-TEST-TRANSPORT-SECRET',
                           'enrollmentAuthority': {'publicKey': 'TEST-PUBLIC-KEY'}}).encode()
    command = generator.private_command(installer.read_bytes())
    script = generator.render(bootstrap, installer.read_bytes()).decode()
    encoded = base64.b64encode(bootstrap).decode()
    assert encoded not in command and 'UNREGISTERED-TEST-TRANSPORT-SECRET' not in command
    assert 'STRING ' + encoded + '\nENTER' in script
    assert not re.search(r'Set-ExecutionPolicy|(?:^|\s)-ExecutionPolicy\s', command)
    # Parse the exact single-quoted outer launch argument, then execute its
    # resulting child command with the download fixture in this test scope.
    launch = next(line[7:] for line in script.splitlines() if line.startswith('STRING powershell.exe -NoLogo -NoProfile -Command '))
    parsed = launch.replace('powershell.exe -NoLogo -NoProfile -Command ', 'Write-Output ', 1)
    setup = '$env:ORBITUS_CAPTURE=' + quote(capture) + '\n'
    actual = '$childCommand=' + parsed + '; & ([scriptblock]::Create($childCommand))'
    result = bootstrap_process('viperlink', installer=installer, command=actual, setup=setup, input_text=encoded+'\n')
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'POLICY_UNCHANGED' in result.stdout
    assert encoded not in result.stdout + result.stderr and 'TEST-TRANSPORT-SECRET' not in result.stdout + result.stderr
    receipt = json.loads(capture.read_text(encoding='utf-8-sig'))
    assert not Path(receipt['path']).exists(), 'Temporary private input was not removed'
    # Invalid installer bytes cannot run even with a valid private bootstrap.
    installer.write_text('throw "Unexpected source executed"', encoding='utf-8')
    capture.unlink()
    failed = bootstrap_process('viperlink', installer=installer, command=command, setup=setup, input_text=encoded+'\n')
    assert failed.returncode != 0 and 'SHA-256 mismatch' in failed.stdout + failed.stderr
    assert not capture.exists()
    print('Private input, outer argument parsing, checksum rejection, cleanup and unchanged policy passed; no live credentials used.')
