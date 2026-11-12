import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountViperLink } from '../static/v/portal.mjs';

function element(dataset = {}, textContent = '') {
  return { dataset, textContent, hidden: false, attributes: {}, handlers: {},
    setAttribute(k,v) { this.attributes[k] = v; }, addEventListener(k,v) { this.handlers[k] = v; } };
}
test('component and OS selections remain independent, including all and clipboard failure', async () => {
  const components = ['cloud','status','lan'].map(component => element({component}));
  const panels = ['cloud','status','lan'].map(componentPanel => element({componentPanel}));
  const platforms = ['windows','macos','linux','all'].map(os => element({os}));
  const commands = ['windows','macos','linux'].map(osPanel => element({osPanel}));
  const copy = element({copy:'selected-command'});
  const ids = Object.fromEntries(['vl-all','vl-detection','vl-copy-status'].map(id=>[id,element()]));
  ids['selected-command'] = element({}, 'exact static command');
  const selectors = {'[data-component]': components, '[data-component-panel]': panels, '[data-os]': platforms, '[data-os-panel]':commands, '[data-copy]':[copy]};
  const doc = {querySelectorAll:s=>selectors[s], getElementById:id=>ids[id]};
  let clipboard;
  const nav = {platform:'MacIntel', clipboard:{async writeText(text){clipboard=text;}}};
  mountViperLink(doc,nav);
  assert.deepEqual(panels.map(p=>p.hidden), [false,true,true]);
  assert.deepEqual(commands.map(p=>p.hidden), [true,false,true]);
  components[2].handlers.click(); platforms[0].handlers.click();
  assert.deepEqual(panels.map(p=>p.hidden), [true,true,false]);
  assert.deepEqual(commands.map(p=>p.hidden), [false,true,true]);
  ids['vl-all'].handlers.click(); platforms[3].handlers.click();
  assert.ok([...panels,...commands].every(p=>!p.hidden));
  await copy.handlers.click(); assert.equal(clipboard,'exact static command');
  nav.clipboard.writeText=async()=>{throw Error('denied');};
  await copy.handlers.click(); assert.match(ids['vl-copy-status'].textContent,/Select and copy/);
});

test('all nine Flipper scripts match their component and platform, with visible execution', async () => {
  const commands=JSON.parse(await readFile(new URL('../data/viperlink_commands.json', import.meta.url),'utf8'));
  assert.equal(commands.length,9);
  assert.equal(new Set(commands.map(c=>c.flipper)).size,9);
  for (const entry of commands) {
    const script=await readFile(new URL(`../static/v/flipper/${entry.flipper}`,import.meta.url),'utf8');
    assert.ok(script.includes(`STRING ${entry.command}\nENTER\n`));
    assert.ok(entry.command.includes(entry.id==='windows' ? `-Component ${entry.component}` : `--component ${entry.component}`));
    assert.doesNotMatch(script,/Set-ExecutionPolicy|(?:^|\s)-ExecutionPolicy\s|Unblock-File|sudo|xattr|spctl|WindowStyle Hidden|ENCODED/i);
    if (entry.adminCommand) {
      const admin = await readFile(new URL(`../static/v/flipper/${entry.adminFlipper}`, import.meta.url), 'utf8');
      assert.ok(admin.includes(`STRING ${entry.adminCommand}\nENTER\n`));
      assert.match(admin, /-Verb RunAs/);
      assert.match(admin, /-Scope Machine/);
      assert.doesNotMatch(admin, /Set-ExecutionPolicy|(?:^|\s)-ExecutionPolicy\s|WindowStyle Hidden|ENCODED/i);
    }
    for (const line of script.trim().split('\n')) assert.match(line,/^(REM|DEFAULT_STRING_DELAY|DELAY|GUI|CTRL|STRING|ENTER)( |$)/);
  }
});

test('status-only package excludes receiver code and source imports stay inside each package', async () => {
  const release=JSON.parse(await readFile(new URL('../data/viperlink_release.json',import.meta.url),'utf8'));
  assert.deepEqual(release.components.find(c=>c.id==='status').files.map(f=>f.name).sort(),['START.txt','cloudkit.mjs','enrollment-format.mjs','queue-format.mjs','report-direct.mjs']);
  for (const component of release.components) {
    const names=new Set(component.files.map(f=>f.name));
    for (const file of component.files.filter(f=>f.name.endsWith('.mjs'))) {
      const source=await readFile(new URL(`../static/v/packages/${release.version}/${component.id}/${file.name}`,import.meta.url),'utf8');
      for (const [,name] of source.matchAll(/from ['"]\.\/([^'"]+)['"]/g)) assert.ok(names.has(name),`${component.id} missing ${name}`);
    }
  }
});
