import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { detectPlatform, mountPortal } from '../static/r/portal.mjs';

test('desktop recommendation handles client hints, old browsers, and mobile exclusions', () => {
  for (const [browser, expected] of [
    [{ userAgentData: { platform: 'Windows' } }, 'windows'],
    [{ platform: 'Win32' }, 'windows'],
    [{ platform: 'MacIntel', maxTouchPoints: 0 }, 'macos'],
    [{ userAgentData: { platform: 'macOS' } }, 'macos'],
    [{ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }, 'linux'],
    [{ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, 'windows'],
    [{ userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux armv8l' }, null],
    [{ platform: 'MacIntel', maxTouchPoints: 5 }, null],
    [{ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64)', platform: 'Linux x86_64' }, null],
    [{ userAgent: 'iPhone' }, null], [{}, null],
  ]) assert.equal(detectPlatform(browser), expected);
});

function element(dataset = {}) {
  return { dataset, hidden: false, textContent: '', attributes: {}, handlers: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    addEventListener(k, v) { this.handlers[k] = v; } };
}
test('platform controls expose all examples and copy only the selected command', async () => {
  const platforms = ['windows', 'macos', 'linux'];
  const buttons = platforms.map(platform => element({ platform }));
  const panels = platforms.map(panel => element({ panel }));
  const copy = element({ copy: 'command-macos' });
  const ids = Object.fromEntries(['ra-show-all', 'ra-detection', 'ra-copy-status', 'command-macos'].map(id => [id, element()]));
  ids['command-macos'].textContent = 'test-command';
  let clipboard;
  const nav = { platform: 'MacIntel', clipboard: { async writeText(value) { clipboard = value; } } };
  const doc = { querySelectorAll(selector) { return { '[data-platform]': buttons, '[data-panel]': panels, '[data-copy]': [copy] }[selector]; }, getElementById(id) { return ids[id]; } };
  mountPortal(doc, nav);
  assert.deepEqual(panels.map(p => p.hidden), [true, false, true]);
  buttons[0].handlers.click();
  assert.deepEqual(panels.map(p => p.hidden), [false, true, true]);
  ids['ra-show-all'].handlers.click();
  assert.deepEqual(panels.map(p => p.hidden), [false, false, false]);
  await copy.handlers.click();
  assert.equal(clipboard, 'test-command');
  nav.clipboard.writeText = async () => { throw new Error('denied'); };
  await copy.handlers.click();
  assert.match(ids['ra-copy-status'].textContent, /Select and copy/);
});

test('Flipper files type the exact published command without policy changes', async () => {
  const commands = JSON.parse(await readFile(new URL('../data/redagent_commands.json', import.meta.url), 'utf8'));
  for (const entry of commands) {
    const payload = await readFile(new URL(`../static/r/flipper/RedAgent-${entry.id}.txt`, import.meta.url), 'utf8');
    assert.ok(payload.includes(`STRING ${entry.command}\nENTER\n`));
    assert.match(payload, /DEFAULT_STRING_DELAY 10/);
    assert.doesNotMatch(payload, /ExecutionPolicy|Unblock-File|sudo|xattr|spctl|WindowStyle Hidden|ENCODED/i);
    for (const line of payload.trim().split('\n')) assert.match(line, /^(REM|DEFAULT_STRING_DELAY|DELAY|GUI|CTRL|STRING|ENTER)( |$)/);
  }
});
