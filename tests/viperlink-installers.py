"""Exercise the real native installer with packaged files, never private profiles or jobs."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
RELEASE = json.loads((ROOT / 'data/viperlink_release.json').read_text())


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='viperlink-installer-')
        self.root = Path(self.temp.name).resolve()
        self.prefix = self.root / 'install with spaces'

    def tearDown(self):
        self.temp.cleanup()

    def run_install(self, component='cloud', source=None, success=True, extra=()):
        source = source or ROOT / 'static/v/packages' / RELEASE['version'] / component
        if os.name == 'nt':
            command = ['powershell.exe', '-NoLogo', '-NoProfile', '-File', str(ROOT / 'static/v/install.ps1'),
                       '-Component', component, '-InstallDir', str(self.prefix), '-SourceDir', str(source), *extra]
        else:
            command = ['sh', str(ROOT / 'static/v/install.sh'), '--component', component,
                       '--prefix', str(self.prefix), '--source-dir', str(source), *extra]
        result = subprocess.run(command, text=True, capture_output=True, timeout=60)
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def destination(self, component='cloud'):
        return self.prefix / component / RELEASE['version']

    def test_install_all_components_and_repeat_preserves_unrelated_files(self):
        self.prefix.mkdir()
        (self.prefix / 'operator-notes.txt').write_text('preserve me')
        for component in RELEASE['components']:
            with self.subTest(component=component['id']):
                self.run_install(component['id'])
                expected = {entry['name'] for entry in component['files']} | {'installation.txt'}
                self.assertEqual(set(p.name for p in self.destination(component['id']).iterdir()), expected)
                self.assertIn('already installed and verified', self.run_install(component['id']).stdout)
                self.assertEqual((self.prefix / 'operator-notes.txt').read_text(), 'preserve me')

    def test_corrupt_download_never_publishes_partial_install(self):
        source = self.root / 'corrupted'
        shutil.copytree(ROOT / 'static/v/packages' / RELEASE['version'] / 'cloud', source)
        (source / 'queue-agent.mjs').write_text('unexpected data')
        result = self.run_install(source=source, success=False)
        self.assertIn('SHA-256 mismatch', result.stdout + result.stderr)
        self.assertFalse(self.destination().exists())
        self.assertFalse((self.prefix / '.install-lock').exists())

    def test_existing_unmanaged_directory_is_preserved(self):
        self.destination().mkdir(parents=True)
        note = self.destination() / 'private-note.txt'
        note.write_text('preserve')
        result = self.run_install(success=False)
        self.assertIn('unmanaged', result.stdout + result.stderr)
        self.assertEqual(note.read_text(), 'preserve')
        self.assertEqual(len(list(self.destination().iterdir())), 1)

    def test_repeat_detects_tampered_source_without_overwriting(self):
        self.run_install()
        source = self.destination() / 'queue-agent.mjs'
        source.write_text('locally changed')
        self.run_install(success=False)
        self.assertEqual(source.read_text(), 'locally changed')

    def test_dry_run_does_not_write(self):
        self.run_install(extra=['-DryRun'] if os.name == 'nt' else ['--dry-run'])
        self.assertFalse(self.prefix.exists())

    def test_invalid_component_does_not_write(self):
        self.run_install('unknown', success=False)
        self.assertFalse(self.prefix.exists())

    @unittest.skipIf(os.name == 'nt', 'Windows reparse points need an elevated fixture')
    def test_symlink_prefix_is_rejected(self):
        target = self.root / 'untouched'
        target.mkdir()
        self.prefix.symlink_to(target, target_is_directory=True)
        self.run_install(success=False)
        self.assertEqual(list(target.iterdir()), [])


if __name__ == '__main__':
    unittest.main()
