"""Visible Windows installer commands; no execution-policy or security changes."""
import hashlib
import re

POLICY_CHECK = (
    "if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') "
    "{ throw 'Use your administrator-approved installer: PowerShell language is restricted.' }; "
    "if ((Get-ExecutionPolicy -Scope MachinePolicy) -ne 'Undefined' -or "
    "(Get-ExecutionPolicy -Scope UserPolicy) -ne 'Undefined' -or "
    "(Get-ExecutionPolicy) -eq 'AllSigned') "
    "{ throw 'Use your administrator-approved installer: a managed or signing policy is configured.' }; "
)


def windows_command(product, installer, arguments=''):
    """Pin the exact installer bytes before invoking them as console commands.

    Restricted permits console commands but rejects .ps1 file invocation. Refuse
    any configured Group Policy, AllSigned, or constrained language session;
    those machines need their administrator's approved distribution process.
    Keep the downloaded source available for review until execution finishes.
    """
    assert product in ('redagent', 'viperlink')
    route = 'r' if product == 'redagent' else 'v'
    digest = hashlib.sha256(installer).hexdigest()
    assert '\n' not in arguments and '\r' not in arguments
    command = (
        "& { $ErrorActionPreference='Stop'; " + POLICY_CHECK +
        f"$p=Join-Path $env:TEMP ('{product}-'+[guid]::NewGuid()+'.ps1'); "
        "try { "
        f"Invoke-WebRequest -UseBasicParsing https://www.orbitusrobotics.com/{route}/install.ps1 "
        "-OutFile $p -TimeoutSec 120 -ErrorAction Stop; "
        "$b=[IO.File]::ReadAllBytes($p); $h=[Security.Cryptography.SHA256]::Create(); "
        "try { $s=[BitConverter]::ToString($h.ComputeHash($b)).Replace('-','').ToLowerInvariant() } "
        "finally { $h.Dispose() }; "
        f"if ($s -ne '{digest}') "
        "{ throw 'Installer SHA-256 mismatch. Download the latest command or Flipper script from the website.' }; "
        "Write-Host ('Verified installer: '+$p); "
        "& ([scriptblock]::Create([Text.Encoding]::UTF8.GetString($b)))"
        + (' ' + arguments if arguments else '') +
        " } finally { if (Test-Path -LiteralPath $p) { Remove-Item -LiteralPath $p -Force } } }"
    )
    assert command.isascii() and not re.search(r'[\r\n]', command)
    return command


def administrator_command(product, installer, arguments=''):
    """Ask Windows for UAC elevation; never type approval or credentials."""
    command = windows_command(product, installer, arguments + ' -Scope Machine -ControlUser ORBITUS_CALLER_SID')
    # Start-Process joins ArgumentList: explicitly quote the entire -Command.
    # The nested command contains no double quotes and the only substitution is
    # a validated Windows SID obtained from the original non-elevated identity.
    assert '"' not in command
    return ("& { $ErrorActionPreference='Stop'; " + POLICY_CHECK +
            "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value; "
            "$c='" + command.replace("'", "''") + "'; "
            "$c=$c.Replace('ORBITUS_CALLER_SID',$sid); "
            "$exe=if ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh.exe' } else { 'powershell.exe' }; "
            "Start-Process -FilePath (Join-Path $PSHOME $exe) -Verb RunAs "
            "-ArgumentList ('-NoLogo -NoProfile -NoExit -Command '+[char]34+$c+[char]34) -ErrorAction Stop }")
