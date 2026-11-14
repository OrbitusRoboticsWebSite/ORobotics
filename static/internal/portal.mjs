import { PortalRepository, identityName, validateConfig, validateCatalog, filterItems, formatBytes, safeURL, MAX_FILE_BYTES } from './core.mjs';
const $ = id => document.getElementById(id);
const labels = { home: 'Overview', documents: 'Document library', news: 'Company journal', work: 'Work & deliverables', whitepapers: 'White papers', admin: 'Publishing' };
let container, identity = '', repo, catalog, catalogTag, admin = false, generation = 0, activeView = 'home', lastActivity = Date.now(), heartbeatBusy = false, publishing = false;
const blobURLs = new Set();
function node(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function button(text, callback, className = 'text-button') { const b = node('button', text, className); b.type = 'button'; b.addEventListener('click', callback); return b; }
function sourceLink(source) { const a = node('a', `${source.label} ↗`, 'source-link'); a.href = safeURL(source.url); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function dateLabel(date) { const d = new Date(date); return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); }
function clearContent(message = 'Workspace locked. Check access again or use Apple’s Sign Out button to end your Apple session.') {
  generation++; repo = undefined; catalog = undefined; catalogTag = undefined; admin = false; publishing = false;
  for (const url of blobURLs) URL.revokeObjectURL(url); blobURLs.clear();
  for (const id of ['featured','metrics','quick-documents','recent-work','documents','news','work','whitepapers','article-content']) $(id).replaceChildren();
  $('article-dialog').close(); $('workspace').hidden = true; $('locked').hidden = false; $('admin-nav').hidden = true;
  $('search').value = ''; $('document-category').replaceChildren(new Option('All collections', '')); $('catalog-file').value = ''; $('upload-form').reset();
  $('admin-result').textContent = ''; $('auth-status').textContent = message; $('retry').hidden = !identity;
  $('identity-note').hidden = !identity; $('identity-note').textContent = identity ? `Account reference for your administrator: ${identity}` : '';
}
function showView(view, focus = true) {
  if (!catalog || !(view in labels) || (view === 'admin' && !admin)) return;
  activeView = view;
  for (const key of Object.keys(labels)) $(`${key}-view`).hidden = key !== view;
  document.querySelectorAll('[data-view]').forEach(b => { if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  $('breadcrumb').textContent = `Workspace / ${labels[view]}`;
  if (focus) { $('workspace-main').focus(); window.scrollTo({ top: 0, behavior: 'instant' }); }
}
function badge(status = '') { return node('span', status, `status-badge ${/pending|review|needs|unverified|not filed/i.test(status) ? 'pending' : /draft|development|research|pilot/i.test(status) ? 'draft' : ''}`); }
function empty(target, text) { if (!target.children.length) target.append(node('p', text, 'empty')); }
function saveBlob(bytes, filename, mime) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime })); blobURLs.add(url);
  const a = node('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => { URL.revokeObjectURL(url); blobURLs.delete(url); }, 5000);
}
async function download(doc, b, status) {
  if (!repo || !catalog) return; const currentRepo = repo, current = generation;
  b.disabled = true; status.textContent = 'Checking access and fetching the file…';
  try {
    // Refresh authorization on the catalog as well as each protected chunk.
    const fresh = await currentRepo.catalog();
    if (!fresh.catalog.documents.some(d => d.id === doc.id && d.sha256 === doc.sha256)) throw new Error('This edition is no longer listed. Refresh the workspace.');
    const bytes = await currentRepo.document(doc, fraction => { if (current === generation) status.textContent = `Loading ${Math.round(fraction * 100)}%…`; });
    if (current !== generation) return;
    saveBlob(bytes, doc.filename, doc.mime); status.textContent = 'Checksum verified. Download prepared.';
  } catch { if (current === generation) clearContent('The file could not be verified or access has changed. Check access again.'); }
  finally { if (current === generation) b.disabled = false; }
}
function documentCard(doc) {
  const card = node('article', undefined, 'document-card');
  card.append(node('div', doc.filename.split('.').pop().toUpperCase(), 'file-icon'), node('p', doc.category, 'eyebrow'), node('h3', doc.title), node('p', doc.summary));
  const bottom = node('div', undefined, 'card-bottom'); const status = node('p', '', 'download-status'); status.setAttribute('role', 'status');
  const b = button('Download ↓', () => download(doc, b, status), 'download-button');
  bottom.append(node('span', `${doc.version ? `v${doc.version} · ` : ''}${formatBytes(doc.bytes)}`), b); card.append(bottom, status);
  const details = node('details'); details.append(node('summary', 'Edition details'), node('p', `${dateLabel(doc.date)} · ${doc.status || 'Internal document'}`), node('code', `SHA-256 ${doc.sha256}`)); card.append(details); return card;
}
function workRow(item) {
  const row = node('article', undefined, 'work-row'), main = node('div');
  main.append(node('h3', item.title), node('p', item.summary));
  for (const link of (item.links || []).slice(0, 2)) main.append(sourceLink(link));
  row.append(main, badge(item.status), node('small', dateLabel(item.evidenceDate || item.date))); return row;
}
function openArticle(item) {
  if (!catalog) return; const content = $('article-content'); content.replaceChildren(node('p', `${item.category || 'Company journal'} · ${dateLabel(item.date)}`, 'eyebrow'), node('h2', item.title), node('p', item.summary));
  for (const paragraph of item.body || []) content.append(node('p', paragraph));
  for (const link of item.links || []) content.append(sourceLink(link));
  $('article-dialog').showModal();
}
function newsCard(item) {
  const card = node('article', undefined, 'news-card');
  if (item.image && new URL(item.image).origin === 'https://www.orbitusrobotics.com') { const img = node('img', undefined, 'news-image'); img.src = item.image; img.alt = item.title; img.loading = 'lazy'; card.append(img); }
  card.append(node('p', `${item.category || 'Journal'} · ${dateLabel(item.date)}`, 'eyebrow'), node('h2', item.title), node('p', item.summary), button('Read the update ↗', () => openArticle(item))); return card;
}
function paperCard(item) {
  const card = node('article', undefined, 'document-card'); card.append(node('div', 'PAPER', 'file-icon'), node('p', item.category || 'Research', 'eyebrow'), node('h3', item.title), node('p', item.summary));
  const bottom = node('div', undefined, 'card-bottom'); bottom.append(badge(item.status), node('span', `${item.version ? `v${item.version} · ` : ''}${dateLabel(item.date)}`)); card.append(bottom);
  for (const link of item.links || []) card.append(sourceLink(link)); return card;
}
function render() {
  if (!catalog) return;
  const q = $('search').value, docs = filterItems(catalog.documents, q, $('document-category').value), news = filterItems(catalog.news, q), work = filterItems(catalog.work, q), papers = filterItems(catalog.whitepapers, q);
  $('edition-date').textContent = dateLabel(catalog.updatedAt); $('catalog-date').textContent = `Catalog updated ${dateLabel(catalog.updatedAt)}`; $('footer-version').textContent = `${catalog.title} · ${dateLabel(catalog.updatedAt)}`;
  $('metrics').replaceChildren(...[['Files', catalog.documents.length], ['Deliverables', catalog.work.length], ['Papers', catalog.whitepapers.length]].map(([label, count]) => { const d = node('div', undefined, 'metric'); d.append(node('strong', String(count).padStart(2, '0')), node('small', label)); return d; }));
  $('featured').replaceChildren();
  if (news.length) { const first = news[0]; $('featured').append(node('p', `${first.category || 'Latest update'} · ${dateLabel(first.date)}`, 'eyebrow'), node('h2', first.title), node('p', first.summary), button('Read the update ↗', () => openArticle(first), 'primary')); }
  else $('featured').append(node('p', 'Company journal', 'eyebrow'), node('h2', q ? 'No matching updates.' : 'Space for the next chapter.'), node('p', q ? 'Try a different search.' : 'Your next company edition will appear here.'));
  for (const [id, items, builder] of [['quick-documents', docs.slice(0, 3), documentCard], ['documents', docs, documentCard], ['recent-work', work.slice(0, 4), workRow], ['work', work, workRow], ['news', news, newsCard], ['whitepapers', papers, paperCard]]) { $(id).replaceChildren(...items.map(builder)); empty($(id), q ? 'No matches. Try another search.' : 'There are no published entries in this collection yet.'); }
  $('document-count').textContent = `${docs.length} of ${catalog.documents.length} documents`;
}
async function loadWorkspace() {
  if (!identity || !container) return;
  clearContent('Checking employee access…'); const current = generation; const expectedIdentity = identity;
  const candidate = new PortalRepository(container.publicCloudDatabase, () => current === generation && identity === expectedIdentity && Boolean(identity));
  $('retry').disabled = true;
  try {
    const result = await candidate.catalog(); const canAdmin = await candidate.isAdmin(); candidate.check();
    repo = candidate; catalog = result.catalog; catalogTag = result.tag; admin = canAdmin; lastActivity = Date.now();
    $('document-category').replaceChildren(new Option('All collections', ''), ...[...new Set(catalog.documents.map(d => d.category))].sort().map(c => new Option(c, c)));
    $('locked').hidden = true; $('workspace').hidden = false; $('admin-nav').hidden = !admin; $('access-label').textContent = admin ? 'Administrator access' : 'Employee access';
    $('workspace-notice').hidden = true; render(); showView(activeView === 'admin' && !admin ? 'home' : activeView, false);
  } catch { if (current === generation) clearContent('Access is unavailable. Your Apple account may need employee approval, or the workspace is not ready. No private content is displayed.'); }
  finally { $('retry').disabled = false; }
}
async function setIdentity(value) { identity = identityName(value); clearContent(identity ? 'Checking employee access…' : 'Sign in with the Apple account approved by your administrator.'); if (identity) await loadWorkspace(); }
function watchAuth(signedIn) {
  (signedIn ? container.whenUserSignsOut() : container.whenUserSignsIn()).then(value => { watchAuth(!signedIn); return setIdentity(signedIn ? null : value); }).catch(() => { identity = ''; clearContent('Apple sign-in is unavailable. Reload the page to retry.'); });
}
async function initialize() {
  try {
    const response = await fetch('./config.json', { cache: 'no-store', credentials: 'omit' }); if (!response.ok) throw new Error();
    const config = validateConfig(await response.json());
    if (!config.enabled) { clearContent('This workspace is being prepared. Employee sign-in will be available after administrator setup.'); return; }
    await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = 'https://cdn.apple-cloudkit.com/ck/2/cloudkit.js'; script.onload = resolve; script.onerror = reject; document.head.append(script); });
    window.CloudKit.configure({ containers: [{ containerIdentifier: config.container, environment: config.environment, apiTokenAuth: { apiToken: config.apiToken, persist: false, signInButton: { id: 'apple-sign-in' }, signOutButton: { id: 'apple-sign-out' } } }] });
    container = window.CloudKit.getDefaultContainer(); const initial = await container.setUpAuth(); watchAuth(Boolean(identityName(initial))); await setIdentity(initial);
  } catch { identity = ''; clearContent('The secure workspace connection is unavailable. Reload to retry.'); }
}
document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showView(b.dataset.go)));
$('search').addEventListener('input', render); $('document-category').addEventListener('change', render);
$('retry').addEventListener('click', loadWorkspace); $('refresh').addEventListener('click', loadWorkspace); $('lock').addEventListener('click', () => clearContent());
$('close-article').addEventListener('click', () => $('article-dialog').close()); $('article-dialog').addEventListener('close', () => $('article-content').replaceChildren());
window.addEventListener('pagehide', () => clearContent());
window.addEventListener('pageshow', event => { if (event.persisted) clearContent('This restored page is locked. Check access again.'); });
for (const name of ['pointerdown','keydown','touchstart']) document.addEventListener(name, () => { lastActivity = Date.now(); }, { passive: true });
setInterval(async () => {
  if (!repo || !catalog || heartbeatBusy || publishing) return;
  if (Date.now() - lastActivity > 15 * 60 * 1000) { clearContent('Workspace locked after 15 minutes without activity. Check access again.'); return; }
  heartbeatBusy = true; const current = generation;
  try { await repo.catalog(); }
  catch { if (current === generation) clearContent('The employee connection could not be verified. Check access again.'); }
  finally { heartbeatBusy = false; }
}, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && catalog && Date.now() - lastActivity > 15 * 60 * 1000) clearContent('Workspace locked after inactivity. Check access again.'); });
$('export-catalog').addEventListener('click', () => { if (admin && catalog) saveBlob(JSON.stringify(catalog, null, 2), 'orbitus-internal-catalog.json', 'application/json'); });
$('publish-catalog').addEventListener('click', async () => {
  if (!admin || !repo || publishing) return; const file = $('catalog-file').files[0]; if (!file || file.size > 600000) { $('admin-result').textContent = 'Select a catalog JSON under 600 KB.'; return; }
  const current = generation, currentRepo = repo; publishing = true; $('publish-catalog').disabled = true;
  try {
    const next = validateCatalog(JSON.parse(await file.text())); const fresh = await currentRepo.catalog();
    const docs = new Map(fresh.catalog.documents.map(d => [d.id, d])); for (const d of next.documents) { if (!docs.has(d.id)) throw new Error('Upload new files before catalog import'); if (docs.get(d.id).sha256 !== d.sha256) throw new Error('Document checksum cannot change'); }
    next.documents = [...docs.values()]; next.updatedAt = new Date().toISOString();
    await currentRepo.publish(next, fresh.tag); currentRepo.check(); await loadWorkspace(); showView('admin'); $('admin-result').textContent = 'Catalog published. Existing file editions preserved.';
  } catch { if (current === generation) $('admin-result').textContent = 'Publication was not confirmed. Check the JSON, administrator access and any concurrent edits, then retry.'; }
  finally { publishing = false; $('publish-catalog').disabled = false; }
});
$('upload-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!admin || !repo || publishing) return;
  const file = $('document-file').files[0]; if (!file || file.size < 1 || file.size > MAX_FILE_BYTES) { $('admin-result').textContent = 'Select a file between 1 byte and 20 MB.'; return; }
  const mime = { pdf: 'application/pdf', txt: 'text/plain', json: 'application/json', zip: 'application/zip' }[file.name.split('.').pop().toLowerCase()];
  const current = generation, currentRepo = repo; publishing = true; const submit = $('upload-form').querySelector('button'); submit.disabled = true;
  try {
    const doc = await currentRepo.upload(new Uint8Array(await file.arrayBuffer()), { title: $('document-title').value.trim(), filename: file.name, mime, summary: $('document-summary').value.trim(), category: $('upload-category').value, version: $('document-version').value.trim(), date: new Date().toISOString().slice(0, 10), status: 'Internal document' }, p => { if (current === generation) $('admin-result').textContent = `Uploading ${Math.round(p * 100)}%…`; });
    const fresh = await currentRepo.catalog(); fresh.catalog.documents.unshift(doc); fresh.catalog.updatedAt = new Date().toISOString();
    await currentRepo.publish(fresh.catalog, fresh.tag); currentRepo.check(); await loadWorkspace(); showView('admin'); $('admin-result').textContent = 'Document stored, read back, checksum verified and published.';
  } catch { if (current === generation) $('admin-result').textContent = 'Publication was not confirmed. Check access and retry. Incomplete uploads do not appear in the catalog.'; }
  finally { publishing = false; submit.disabled = false; }
});
initialize();
