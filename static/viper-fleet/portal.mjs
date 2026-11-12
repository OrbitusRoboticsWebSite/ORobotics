import { platformNames, isRecent, versionLabel, filterMachines, exampleReport, sampleMachines, queryFleet } from './core.mjs';
import { attachQueue } from './queue.mjs';

const $ = id => document.getElementById(id);
let machines = [], mode = 'locked', identity, container, config, generation = 0;
const queue = attachQueue({ database: () => container.publicCloudDatabase, configuration: () => config,
  authorized: () => Boolean(identity) && mode === 'live' && config?.commandsEnabled === true });
function text(id, value) { $(id).textContent = value; }
function clearRecords() { generation++; machines = []; $('details').close(); text('detail-json', ''); render(); }
function render() {
  const filters = { search: $('search').value, platform: $('platform').value, flavor: $('flavor').value, status: $('status').value };
  const shown = filterMachines(machines, filters);
  const loaded = mode === 'demo' || mode === 'live';
  text('count-total', loaded ? shown.length : '—');
  text('count-recent', loaded ? shown.filter(r => isRecent(r)).length : '—');
  text('count-attention', loaded ? shown.filter(r => r.health === 'attention').length : '—');
  text('count-stale', loaded ? shown.filter(r => !isRecent(r)).length : '—');
  text('source-label', mode === 'demo' ? 'INVENTED SAMPLE DATA' : 'PRIVATE REGISTRY');
  text('results-status', loaded ? `${shown.length} of ${machines.length} ${mode === 'demo' ? 'sample ' : ''}machines · reports received most recently first` : 'Sign in to load your fleet, or explore the sample preview.');
  $('refresh').disabled = !identity || mode === 'demo';
  $('leave-demo').hidden = mode !== 'demo';
  $('demo').hidden = mode === 'demo';
  $('machines').replaceChildren();
  $('empty-state').hidden = shown.length > 0;
  $('empty-state').querySelector('h3').textContent = loaded ? (machines.length ? 'No machines match these filters.' : 'No machine reports yet.') : 'Your fleet belongs to you.';
  $('empty-state').querySelector('p').textContent = loaded ? (machines.length ? 'Try a different platform, version, or search.' : 'Enrolled machines appear after their first accepted report.') : 'No machine records are included in this public page. The preview uses invented examples.';
  for (const r of shown) {
    const row = document.createElement('tr');
    function cell(primary, secondary) {
      const td = document.createElement('td'), strong = document.createElement('strong');
      strong.textContent = primary; td.append(strong);
      if (secondary) { const small = document.createElement('small'); small.textContent = secondary; td.append(small); }
      row.append(td); return td;
    }
    cell(r.hostLabel, r.tags.join(' / '));
    cell(platformNames[r.os.family], versionLabel(r));
    const health = cell(''); health.replaceChildren();
    const badge = document.createElement('span'); badge.className = `badge ${r.health}`;
    badge.textContent = { ok: 'OK reported', attention: 'Needs attention', unknown: 'Unknown' }[r.health]; health.append(badge);
    const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(r.receivedAt)) / 60000));
    cell(minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hr ago`, isRecent(r) ? 'Recent report' : 'Stale report');
    const td = document.createElement('td'), button = document.createElement('button');
    button.className = 'row-action'; button.textContent = 'View report ↗'; button.setAttribute('aria-label', `View report for ${r.hostLabel}`);
    button.addEventListener('click', () => {
      text('detail-title', r.hostLabel); text('detail-note', mode === 'demo' ? 'Invented sample report. This is not a real corporate machine.' : 'Device-reported status. Receipt time is the CloudKit server modification time.');
      text('detail-json', JSON.stringify(r, null, 2)); $('details').showModal();
    }); td.append(button); row.append(td); $('machines').append(row);
  }
}
function updateFlavors() {
  const selected = $('flavor').value;
  const names = [...new Set(machines.filter(r => !$('platform').value || r.os.family === $('platform').value).map(versionLabel))].sort();
  $('flavor').replaceChildren(new Option('All versions', ''), ...names.map(n => new Option(n, n)));
  if (names.includes(selected)) $('flavor').value = selected;
}
function notice(message, label) { text('mode-notice', message); text('connection-label', label); }
function demo() {
  clearRecords(); mode = 'demo'; machines = sampleMachines(); updateFlavors();
  notice('Sample preview · All five machines are invented. Nothing is sent or stored.', 'Sample data'); render();
}
$('demo').addEventListener('click', demo);
$('leave-demo').addEventListener('click', async () => {
  mode = 'locked'; clearRecords(); updateFlavors();
  if (identity) await loadFleet();
  else notice(config?.enabled ? 'Sign in with an authorized Apple account to load private reports.' : 'Staged portal · Live sign-in and machine reporting are not activated.', config?.enabled ? 'Signed out' : 'Staging preview');
});
$('close-details').addEventListener('click', () => $('details').close());
$('details').addEventListener('close', () => text('detail-json', ''));
for (const id of ['search', 'platform', 'flavor', 'status']) $(id).addEventListener('input', () => { if (id === 'platform') updateFlavors(); render(); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
  const view = button.dataset.view;
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b === button));
  $('fleet-view').hidden = view !== 'fleet'; $('report-view').hidden = view !== 'report'; $('queue-view').hidden = view !== 'queue'; queue.render();
}));
function showRequest() {
  text('request-example', `# Node.js 22 or later. Keep the profile and key outside the website.
# Validate locally first; this does not send a report.
node report-direct.mjs --profile /private/reporter-profile.json --report status.json --validate

# Send a signed HTTPS JSON request directly to Apple.
node report-direct.mjs --profile /private/reporter-profile.json --report status.json`);
  const { deviceId, reportedAt, ...payload } = exampleReport();
  text('payload-example', JSON.stringify(payload, null, 2));
}
$('copy-request').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('request-example').textContent); text('copy-status', 'Template copied. Set your private profile path and actual status before use.'); }
  catch { text('copy-status', 'Select and copy the template below.'); }
});
$('refresh').addEventListener('click', loadFleet);

async function loadFleet() {
  if (!identity || !container) return;
  mode = 'locked'; clearRecords(); const current = generation;
  $('refresh').disabled = true; text('auth-status', 'Checking fleet access and loading reports…');
  try {
    machines = await queryFleet(container.publicCloudDatabase, () => current === generation && Boolean(identity));
    mode = 'live'; updateFlavors(); render();
    await queue.updateFleet(machines); queue.render();
    text('auth-status', 'Authorized fleet access. Reports are held only in this page’s memory.');
    notice(`${config.environment === 'development' ? 'Development pilot' : 'Private fleet'} · CloudKit permissions authorize access. Health values are reported by each machine.`, 'Private connection');
  } catch {
    if (current !== generation) return;
    mode = 'locked'; clearRecords(); queue.clear();
    text('auth-status', 'Fleet unavailable. Your account may not have the FleetAdmin role, or CloudKit could not complete the request.');
    notice('No fleet records displayed. Check your account access or retry the connection.', 'Access unavailable');
    $('refresh').disabled = false;
  }
}
async function setIdentity(value) {
  queue.clear();
  identity = value?.userRecordName || value?.userIdentity?.userRecordName ? value : undefined;
  mode = 'locked'; clearRecords(); updateFlavors();
  if (identity) await loadFleet();
  else { text('auth-status', 'Sign in with the Apple account authorized for this fleet.'); notice('Signed out · No corporate records are loaded.', 'Signed out'); }
}
function watchAuth(signedIn) {
  const next = signedIn ? container.whenUserSignsOut() : container.whenUserSignsIn();
  next.then(value => { watchAuth(!signedIn); return setIdentity(signedIn ? undefined : value); }).catch(authFailed);
}
function authFailed() { identity = undefined; mode = 'locked'; clearRecords(); queue.clear(); text('auth-status', 'Apple sign-in is unavailable. Reload to try again.'); notice('No corporate records are loaded.', 'Connection unavailable'); }
async function initialize() {
  showRequest(); render();
  try {
    const result = await fetch('./config.json', { cache: 'no-store', credentials: 'omit' });
    if (!result.ok) throw new Error('Configuration unavailable');
    config = await result.json();
    if (config.enabled !== true) return;
    if (!/^iCloud\.[A-Za-z0-9.-]+$/.test(config.container) || !config.apiToken || !['production', 'development'].includes(config.environment)) throw new Error('Configuration incomplete');
    text('intake-status', `Direct CloudKit reporting · ${config.environment === 'development' ? 'Development pilot: use synthetic reports while validating access.' : 'Use the profile issued by your administrator.'}`);
    await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';
      script.onload = resolve; script.onerror = reject; document.head.append(script);
    });
    window.CloudKit.configure({ containers: [{ containerIdentifier: config.container, environment: config.environment,
      apiTokenAuth: { apiToken: config.apiToken, persist: false, signInButton: { id: 'apple-sign-in' }, signOutButton: { id: 'apple-sign-out' } } }] });
    container = window.CloudKit.getDefaultContainer();
    const initial = await container.setUpAuth();
    watchAuth(Boolean(initial?.userRecordName || initial?.userIdentity?.userRecordName));
    await setIdentity(initial);
  } catch { authFailed(); }
}
initialize();
