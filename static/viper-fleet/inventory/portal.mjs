import { InventoryView, openInventoryContainer } from './session.mjs';

const find = id => document.getElementById(id);
const form = find('group-form');
const input = find('group');
let view;
let active = true;

function render(message, reports) {
  find('result').textContent = message;
  const rows = find('rows');
  rows.replaceChildren();
  for (const report of reports) {
    const row = rows.insertRow();
    for (const value of [report.hostLabel, report.os.version, report.agentVersion, new Date(report.receivedAt).toLocaleString()]) {
      row.insertCell().textContent = value || '—';
    }
  }
  find('report-table').hidden = !reports.length;
}

function resetIdentity(identity) {
  input.value = '';
  view?.setIdentity(identity);
  form.hidden = !view?.signedIn;
}

async function connect() {
  try {
    const response = await fetch('./config.json', { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Configuration unavailable');
    const config = await response.json();
    if (config.enabled !== true || !active) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
    if (!active) return;
    const container = openInventoryContainer(window.CloudKit, config);
    view = new InventoryView(container.publicCloudDatabase, render);
    let identity = await container.setUpAuth();
    while (active) {
      resetIdentity(identity);
      find('connection').textContent = view.signedIn ? `Signed in · ${config.environment}` : 'Use the Apple account approved for this inventory container.';
      if (view.signedIn) {
        await container.whenUserSignsOut();
        identity = null;
      } else {
        identity = await container.whenUserSignsIn();
      }
    }
  } catch {
    if (!active) return;
    resetIdentity(null);
    find('connection').textContent = 'Inventory sign-in is unavailable. Reload to retry.';
    render('No reports loaded.', []);
  }
}

input.addEventListener('input', () => view?.clear('Choose Load reports to view this group.'));
form.addEventListener('submit', event => {
  event.preventDefault();
  view?.load(input.value.trim());
});
window.addEventListener('pagehide', () => {
  active = false;
  resetIdentity(null);
});
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload(); });
connect();
