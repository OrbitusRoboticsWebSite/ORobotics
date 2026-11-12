#!/usr/bin/env python3
"""Create a PRIVATE Windows administrator Flipper script from a fleet bootstrap."""
import argparse
import base64
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from windows_bootstrap import POLICY_CHECK, windows_command


def private_command(installer):
    install = windows_command('viperlink', installer,
        '-Component cloud -Scope Machine -ControlUser ORBITUS_CALLER_SID -EnrollmentFile ORBITUS_BOOTSTRAP_PATH')
    # Credentials arrive on the child process's input, never in -Command or
    # PSReadLine history. Interactive input is not echoed. Consume input before
    # checking policy so a policy rejection does not leave secrets at a prompt.
    return (
        "& { $ErrorActionPreference='Stop'; Write-Host 'Receiving private fleet enrollment. Keep this window focused.'; "
        "$encoded=''; if ([Console]::IsInputRedirected) { $encoded=[Console]::ReadLine() } "
        "else { $buffer=New-Object Text.StringBuilder; while ($true) { $pressed=[Console]::ReadKey($true); "
        "if ($pressed.Key -eq [ConsoleKey]::Enter) { break }; "
        "if ($buffer.Length -lt 22000) { [void]$buffer.Append($pressed.KeyChar) } }; $encoded=$buffer.ToString() }; "
        + POLICY_CHECK +
        "if (-not $encoded -or $encoded.Length -gt 22000) { throw 'Private bootstrap was not received.' }; "
        "$bytes=[Convert]::FromBase64String($encoded); $encoded=$null; "
        "$profile=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json; "
        "if ($profile.version -ne 1 -or $profile.kind -ne 'viperlink-auto-enrollment' -or $profile.enrollmentAuthority.privateKey) "
        "{ throw 'Invalid receiver bootstrap.' }; "
        "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; "
        "$folder=Join-Path $env:LOCALAPPDATA ('Orbitus-ViperLink-enrollment-'+[guid]::NewGuid()); "
        "$null=New-Item -ItemType Directory -Path $folder; "
        "try { & icacls.exe $folder /inheritance:r /grant:r ('*'+$sid+':(OI)(CI)F') '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null; "
        "if ($LASTEXITCODE -ne 0) { throw 'Unable to protect private enrollment.' }; "
        "$bootstrap=Join-Path $folder 'bootstrap.json'; [IO.File]::WriteAllBytes($bootstrap,$bytes); $bytes=$null; $profile=$null; "
        "$c='" + install.replace("'", "''") + "'; "
        "$quoted=([char]39).ToString()+$bootstrap.Replace(([char]39).ToString(),([char]39).ToString()+[char]39)+[char]39; "
        "$c=$c.Replace('ORBITUS_CALLER_SID',$sid).Replace('ORBITUS_BOOTSTRAP_PATH',$quoted); "
        "$principal=New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent()); "
        "if ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { & ([scriptblock]::Create($c)) } "
        "else { $c='try { '+$c+'; exit 0 } catch { Write-Error ''ViperLink installation failed. Existing enrollment was preserved.''; exit 1 }'; "
        "$exe=if ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh.exe' } else { 'powershell.exe' }; "
        "$child=Start-Process -FilePath (Join-Path $PSHOME $exe) -Verb RunAs -Wait -PassThru "
        "-ArgumentList ('-NoLogo -NoProfile -Command '+[char]34+$c+[char]34) -ErrorAction Stop; "
        "if ($child.ExitCode -ne 0) { throw 'Administrator installation did not complete.' } }; "
        "Write-Host 'Installed and enrolled. The receiver will report to Viper Fleet when online.' "
        "} finally { Remove-Item -LiteralPath $folder -Recurse -Force }; }"
    )


def render(bootstrap, installer):
    value = json.loads(bootstrap)
    assert value.get('version') == 1 and value.get('kind') == 'viperlink-auto-enrollment'
    assert value.get('privateKeyPEM') and not value['enrollmentAuthority'].get('privateKey')
    assert len(bootstrap) <= 16384
    command = private_command(installer)
    # Outer PowerShell parses a literal string. The nested PowerShell process
    # reads the next Flipper line as private input, not as another shell command.
    launch = "powershell.exe -NoLogo -NoProfile -Command '" + command.replace("'", "''") + "'"
    assert launch.isascii() and len(launch) < 16000
    return '\n'.join([
        'REM PRIVATE ViperLink Cloud automatic enrollment - do not publish this file.',
        'REM Contains your fleet transport credential and public enrollment authority.',
        'REM Each new PC creates its own identity. Repeat installs preserve enrollment.',
        'REM Use on your authorized unlocked Windows PC. Approve normal UAC yourself.',
        'DEFAULT_STRING_DELAY 10', 'DELAY 2000', 'GUI r', 'DELAY 1200',
        'STRING powershell.exe -NoLogo -NoProfile', 'ENTER', 'DELAY 4000',
        'STRING ' + launch, 'ENTER', 'DELAY 5000',
        'STRING ' + base64.b64encode(bootstrap).decode('ascii'), 'ENTER', '',
    ]).encode('ascii')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bootstrap', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    destination = args.output.resolve()
    for parent in destination.parents:
        if (parent / '.git').exists():
            sys.exit('Private enrollment scripts must stay outside Git repositories.')
    content = render(args.bootstrap.read_bytes(), (ROOT / 'static/v/install.ps1').read_bytes())
    with destination.open('xb') as output:
        destination.chmod(0o600)
        output.write(content)
    print('Created private Flipper script: ' + str(destination))
