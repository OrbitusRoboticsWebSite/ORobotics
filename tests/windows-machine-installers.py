"""Install/start/restart/remove real machine jobs on disposable Windows CI hosts."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

from windows_bootstrap_support import ROOT, bootstrap_process, windows_environment

assert os.name == 'nt', 'Run on a disposable Windows host'
product = sys.argv[1]
assert product in ('redagent', 'viperlink')
name = 'RedAgent' if product == 'redagent' else 'ViperLink'
install = Path(os.environ['ProgramFiles']) / 'Orbitus' / name
data = Path(os.environ['ProgramData']) / 'Orbitus' / name
helper = Path(os.environ['ProgramFiles']) / 'Orbitus/RedAgentHelper'
assert not install.exists() and not data.exists(), 'Never replace an existing machine installation in this test'
if product == 'redagent':
    assert not helper.exists()


def ps(command):
    result = subprocess.run(['powershell.exe', '-NoLogo', '-NoProfile', '-Command', command], env=windows_environment(), text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr
    return result.stdout.strip()


def until(callback, timeout=45):
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        try:
            result = callback()
            if result:
                return result
        except (OSError, ValueError, AssertionError):
            pass
        time.sleep(1)
    raise AssertionError('Machine startup/recovery was not observed')


options = ['-Scope', 'Machine']
if product == 'viperlink':
    version = json.loads((ROOT / 'data/viperlink_release.json').read_text())['version']
    options += ['-Component', 'cloud', '-SourceDir', str(ROOT / 'static/v/packages' / version / 'cloud')]
try:
    preview = bootstrap_process(product, options + ['-DryRun'])
    assert preview.returncode == 0, preview.stdout + preview.stderr
    assert not install.exists() and not data.exists(), 'Preview installed machine state'
    result = bootstrap_process(product, options)
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'POLICY_UNCHANGED' in result.stdout
    assert install.exists() and data.exists()
    sentinel = data / 'keep-evidence.txt'
    sentinel.write_text('retained enrollment evidence')
    if product == 'redagent':
        service = json.loads(ps("Get-WmiObject Win32_Service -Filter \"Name='OrbitusRedAgent'\" | Select-Object State,StartMode,StartName,ProcessId | ConvertTo-Json -Compress"))
        assert service['State'] == 'Running' and service['StartMode'] == 'Auto', service
        assert service['StartName'].lower().endswith('localservice'), service
        before = service['ProcessId']
        until(lambda: (data / 'endpoint.json').exists())
        subprocess.run(['taskkill.exe', '/PID', str(before), '/F'], check=True, capture_output=True)
        def recovered():
            service = json.loads(ps("Get-WmiObject Win32_Service -Filter \"Name='OrbitusRedAgent'\" | Select-Object State,ProcessId | ConvertTo-Json -Compress"))
            return service['State'] == 'Running' and service['ProcessId'] not in (0, before)
        until(recovered, 60)
        shortcut = Path(os.environ['ProgramData']) / 'Microsoft/Windows/Start Menu/Programs/RedAgent.lnk'
        assert shortcut.is_file(), 'All-user Start menu shortcut missing'
    else:
        details = json.loads(ps("$s=New-Object -ComObject Schedule.Service; $s.Connect(); $t=$s.GetFolder('\\').GetTask('Orbitus ViperLink Cloud'); @{xml=$t.Xml;state=$t.State;hidden=$t.Definition.Settings.Hidden}|ConvertTo-Json -Compress"))
        assert '<BootTrigger>' in details['xml'], details
        assert '<UserId>S-1-5-19</UserId>' in details['xml'], details
        # Task Scheduler omits default-valued settings when exporting XML.
        assert details['hidden'] is False, details
        assert '<ExecutionTimeLimit>PT0S</ExecutionTimeLimit>' in details['xml'], details
        assert '<TimeTrigger>' in details['xml'] and '<Interval>PT1M</Interval>' in details['xml'], details
        assert '<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>' in details['xml'], details
        status_file = data / 'startup-status.json'
        def waiting():
            status = json.loads(status_file.read_text())
            return status if status['status'] == 'waiting-for-enrollment' else None
        status = until(waiting)
        before = status['pid']
        subprocess.run(['taskkill.exe', '/PID', str(before), '/F'], check=True, capture_output=True)
        until(lambda: (state := waiting()) and state['pid'] != before, 90)
        # Stop and disable recovery before creating an unregistered test profile.
        # No real credential or live CloudKit request is used by this test.
        ps("$s=New-Object -ComObject Schedule.Service; $s.Connect(); $t=$s.GetFolder('\\').GetTask('Orbitus ViperLink Cloud'); $t.Enabled=$false; $t.Stop(0)")
        fixture = Path(tempfile.mkdtemp(prefix='viper-enrollment-fixture-')) / 'bootstrap.json'
        code = r'''
const { generateKeyPairSync } = await import('node:crypto');
const { writeFile } = await import('node:fs/promises');
const { createAuthority } = await import(process.env.ORBITUS_AUTHORITY_MODULE);
const { privateKey, ...publicAuthority } = await createAuthority();
const privateKeyPEM = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
await writeFile(process.env.ORBITUS_FIXTURE, JSON.stringify({version:1,kind:'viperlink-auto-enrollment',container:'iCloud.orbitusrobotics.ViperFleet',environment:'development',keyID:'UNREGISTERED-CI-ONLY',privateKeyPEM,intervalMinutes:5,enrollmentAuthority:publicAuthority}));
'''
        source = ROOT / 'static/v/packages' / version / 'cloud'
        env = dict(os.environ, ORBITUS_FIXTURE=str(fixture), ORBITUS_AUTHORITY_MODULE=(source / 'enrollment-format.mjs').as_uri())
        subprocess.run(['node', '--input-type=module', '-e', code], env=env, check=True, capture_output=True)
        enrolled = subprocess.run(['node', str(source / 'auto-enroll.mjs'), '--bootstrap', str(fixture), '--data', str(data)], check=True, capture_output=True, text=True)
        assert json.loads(enrolled.stdout)['enabled'] is True
        profile = data / 'receiver.json'
        value = json.loads(profile.read_text()); original_id = value['deviceId']
        value['enabled'] = False
        profile.write_text(json.dumps(value))
        options += ['-EnrollmentFile', str(fixture)]
    # Reinstallation must preserve data and keep exactly one machine definition.
    repeat = bootstrap_process(product, options)
    assert repeat.returncode == 0, repeat.stdout + repeat.stderr
    assert 'POLICY_UNCHANGED' in repeat.stdout
    assert sentinel.read_text() == 'retained enrollment evidence'
    if product == 'viperlink':
        assert json.loads(profile.read_text())['deviceId'] == original_id
        assert json.loads(profile.read_text())['enabled'] is False
        until(lambda: json.loads(status_file.read_text())['status'] == 'disabled')
        fixture.unlink()
        fixture.parent.rmdir()
    print(json.dumps({'product': product, 'checks': ['Restricted policy unchanged', 'machine install', 'LocalService', 'startup definition', 'crash recovery', 'repeat install preserves data'], 'physicalRebootTested': False, 'privateEnrollmentUsed': False}))
except Exception:
    if product == 'viperlink':
        try:
            print(ps("$s=New-Object -ComObject Schedule.Service; $s.Connect(); $t=$s.GetFolder('\\').GetTask('Orbitus ViperLink Cloud'); @{state=$t.State;lastResult=$t.LastTaskResult;nextRun=$t.NextRunTime;xml=$t.Xml}|ConvertTo-Json -Compress"))
            status = data / 'startup-status.json'
            if status.exists(): print(status.read_text())
        except Exception:
            pass
    raise
finally:
    if product == 'redagent':
        executable = helper / 'RedAgentHelper.exe'
        if executable.exists():
            result = subprocess.run([str(executable), 'uninstall'], capture_output=True, text=True)
            assert result.returncode == 0, result.stdout + result.stderr
    else:
        ps("$s=New-Object -ComObject Schedule.Service; $s.Connect(); $f=$s.GetFolder('\\'); try { $t=$f.GetTask('Orbitus ViperLink Cloud'); $t.Stop(0); $f.DeleteTask('Orbitus ViperLink Cloud',0) } catch { if ($_.Exception.GetBaseException().HResult -ne -2147024894) { throw } }")
    for folder in [install, data] + ([helper] if product == 'redagent' else []):
        if folder.exists():
            until(lambda folder=folder: (shutil.rmtree(folder), True)[1], 20)
