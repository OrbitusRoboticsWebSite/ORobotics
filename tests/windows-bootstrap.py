"""Regression for the Windows client default that rejects .ps1 file invocation."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from windows_bootstrap_support import assert_published_commands, bootstrap_process, windows_command, administrator_command


class BootstrapTests(unittest.TestCase):
    def test_published_commands_pin_current_installer(self):
        assert_published_commands()

    @unittest.skipUnless(os.name == 'nt', 'Native Windows execution-policy regression')
    def test_restricted_blocks_file_but_verified_console_install_runs(self):
        with tempfile.TemporaryDirectory(prefix='orbitus-bootstrap-') as folder:
            fixture = Path(folder) / 'installer with spaces.ps1'
            marker = Path(folder) / 'executed.txt'
            fixture.write_text("param($Scope='User',$ControlUser=''); [IO.File]::WriteAllText('" + str(marker).replace("'", "''") + "', 'verified')", encoding='utf-8')
            old = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Restricted',
                                  '-File', str(fixture)], capture_output=True, text=True)
            self.assertNotEqual(old.returncode, 0, old.stdout + old.stderr)
            self.assertFalse(marker.exists(), 'Control should reproduce the reported failure')
            for product in ('redagent', 'viperlink'):
                result = bootstrap_process(product, installer=fixture)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertIn('POLICY_UNCHANGED', result.stdout)
                self.assertEqual(marker.read_text(), 'verified')
                marker.unlink()
                pinned = windows_command(product, fixture.read_bytes() + b'changed')
                bad = bootstrap_process(product, installer=fixture, command=pinned)
                self.assertNotEqual(bad.returncode, 0)
                self.assertIn('Installer SHA-256 mismatch', bad.stdout + bad.stderr)
                self.assertIn('POLICY_UNCHANGED', bad.stdout)
                self.assertFalse(marker.exists(), 'Unverified source executed')
                # Simulate each managed scope without modifying registry policy.
                for scope in ('MachinePolicy', 'UserPolicy'):
                    setup = "function Get-ExecutionPolicy { param($Scope) if ($Scope -eq '" + scope + "') { 'Restricted' } else { 'Undefined' } }"
                    blocked = bootstrap_process(product, installer=fixture, setup=setup)
                    self.assertNotEqual(blocked.returncode, 0)
                    self.assertIn('administrator-approved', blocked.stdout + blocked.stderr)
                    self.assertFalse(marker.exists())
                signed = bootstrap_process(product, installer=fixture, policy='AllSigned')
                self.assertNotEqual(signed.returncode, 0)
                self.assertIn('administrator-approved', signed.stdout + signed.stderr)
                self.assertFalse(marker.exists())
                # Inspect the actual RunAs handoff without interacting with UAC
                # on unattended CI. Then execute the exact unquoted child command.
                setup = r'''function Start-Process {
                    [CmdletBinding()] param($FilePath,$Verb,$ArgumentList)
                    if ($Verb -ne 'RunAs' -or $FilePath -ne (Join-Path $PSHOME 'powershell.exe')) { throw 'Wrong elevation request' }
                    $prefix='-NoLogo -NoProfile -NoExit -Command "'
                    if (-not $ArgumentList.StartsWith($prefix) -or -not $ArgumentList.EndsWith('"')) { throw 'Broken command quoting' }
                    $child=$ArgumentList.Substring($prefix.Length,$ArgumentList.Length-$prefix.Length-1)
                    & ([scriptblock]::Create($child))
                }'''
                elevated = bootstrap_process(product, installer=fixture,
                    command=administrator_command(product, fixture.read_bytes()), setup=setup)
                self.assertEqual(elevated.returncode, 0, elevated.stdout + elevated.stderr)
                self.assertTrue(marker.exists())
                marker.unlink()
                cancelled = bootstrap_process(product, installer=fixture,
                    command=administrator_command(product, fixture.read_bytes()),
                    setup="function Start-Process { throw 'Administrator cancelled UAC' }")
                self.assertNotEqual(cancelled.returncode, 0)
                self.assertIn('cancelled UAC', cancelled.stdout + cancelled.stderr)
                self.assertFalse(marker.exists())
                constrained = bootstrap_process(product, installer=fixture,
                    setup="$ExecutionContext.SessionState.LanguageMode='ConstrainedLanguage'")
                self.assertNotEqual(constrained.returncode, 0)
                self.assertIn('PowerShell language is restricted', constrained.stdout + constrained.stderr)
                self.assertFalse(marker.exists())


if __name__ == '__main__':
    unittest.main()
