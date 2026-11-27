const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const validID = value => typeof value === 'string' && /^[A-Z0-9][A-Z0-9_-]{0,23}$/i.test(value);
const text = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);

export function calendarYear(doc) {
  const match = doc.mime === 'application/json' && /^photo-picker-([1-9]\d{3})\.json$/.exec(doc.filename);
  return match ? Number(match[1]) : null;
}

export function calendarRoute(hash) {
  const match = /^#calendar\/([1-9]\d{3})$/.exec(hash);
  return match ? Number(match[1]) : null;
}

function inlineJPEG(uri) {
  if (typeof uri !== 'string' || uri.length > 2_800_000 || !uri.startsWith('data:image/jpeg;base64,/9j/')) return false;
  const body = uri.slice('data:image/jpeg;base64,'.length);
  if (body.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return false;
  const binary = atob(body);
  if (!binary.endsWith('\xff\xd9')) return false;
  // Approved crops are metadata-free JPEGs. Verify frame bounds before assigning an image src.
  let i = 2, frame = false;
  while (i + 4 < binary.length && binary.charCodeAt(i++) === 255) {
    const marker = binary.charCodeAt(i++);
    if (marker === 218) return frame;
    const length = (binary.charCodeAt(i) << 8) + binary.charCodeAt(i+1);
    if (length < 2 || i + length > binary.length) return false;
    if (marker === 192 || marker === 194) {
      if (length < 8) return false;
      const h = (binary.charCodeAt(i+3) << 8) + binary.charCodeAt(i+4);
      const w = (binary.charCodeAt(i+5) << 8) + binary.charCodeAt(i+6);
      if (!w || !h || w > 4096 || h > 4096) return false;
      frame = true;
    }
    if ((marker >= 225 && marker <= 239) || marker === 254) return false;
    i += length;
  }
  return false;
}

export function validateCalendar(value, expectedYear) {
  if (value?.schemaVersion !== 1 || value.year !== expectedYear || !Number.isInteger(value.year) ||
      value.year < 1000 || value.year > 9999 || !Array.isArray(value.photos) ||
      value.photos.length < 12 || value.photos.length > 100) throw Error('Invalid calendar edition');
  const ids = new Set(), proposed = new Set();
  for (const p of value.photos) {
    if (!p || !validID(p.id) || !text(p.title, 200) || !p.title.trim() ||
        !text(p.caption, 1800) || !text(p.source, 220) || !p.source.trim() ||
        !Number.isInteger(p.ppi) || p.ppi <= 0 || p.ppi > 10000 ||
        !Array.isArray(p.aliases) || p.aliases.length > 16 ||
        !p.aliases.every(validID) || !inlineJPEG(p.uri)) throw Error('Invalid calendar photograph');
    for (const id of [p.id, ...p.aliases]) {
      if (ids.has(id.toUpperCase())) throw Error('Duplicate photograph identifier');
      ids.add(id.toUpperCase());
    }
    if (p.month !== '') {
      if (!MONTHS.includes(p.month) || proposed.has(p.month)) throw Error('Invalid proposed month');
      proposed.add(p.month);
    }
  }
  if (proposed.size !== 12) throw Error('The calendar requires twelve proposed months');
  return value;
}

// Always resolve the edition against a fresh ACL-protected catalog. Both browser
// publishing and the catalog importer place the active edition first.
export async function loadCalendarEdition(repository, year, progress) {
  const { catalog } = await repository.catalog();
  const document = catalog.documents.find(item => calendarYear(item) === year);
  if (!document) return null;
  const bytes = await repository.document(document, progress);
  try {
    repository.check();
    return validateCalendar(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)), year);
  } finally {
    bytes.fill(0);
  }
}

export function assignPhoto(slots, id, month) {
  if (month !== '' && !MONTHS.includes(month)) throw Error('Invalid month');
  const next = slots.map(old => old === id ? '' : old);
  if (month) next[MONTHS.indexOf(month)] = id;
  return next;
}

export function restoreChoices(receipt, year, photos) {
  const lines = receipt.trimEnd().split(/\r?\n/);
  const header = /^(\d{4}) calendar choices \((\d{1,2})\/12\)$/.exec(lines.shift());
  if (!header || Number(header[1]) !== year || lines.length !== 12) throw Error('Unexpected calendar year or format');
  const ids = new Map(photos.flatMap(p => [p.id, ...p.aliases].map(id => [id, p.id])));
  const slots = MONTHS.map((month, i) => {
    const prefix = month + ' — ';
    if (!lines[i].startsWith(prefix)) throw Error('Unexpected month');
    const value = lines[i].slice(prefix.length);
    if (value === 'Unassigned') return '';
    const id = ids.get(value.split(' · ')[0]);
    if (!id) throw Error('Unknown photograph');
    return id;
  });
  const assigned = slots.filter(Boolean);
  if (new Set(assigned).size !== assigned.length || assigned.length !== Number(header[2])) throw Error('Inconsistent choices');
  return slots;
}

function element(tag, copy, cls) {
  const node = document.createElement(tag);
  if (copy) node.textContent = copy;
  if (cls) node.className = cls;
  return node;
}

function control(copy, action, cls = 'secondary') {
  const button = element('button', copy, cls);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function labeled(copy, input) {
  const label = element('label', copy);
  label.append(input);
  return label;
}

// data has already been verified by validateCalendar. Return a disposer for all private view state.
export function mountCalendar(target, data, saveText) {
  const byID = new Map(data.photos.map(p => [p.id, p]));
  const year = data.year;
  const proposed = MONTHS.map(month => data.photos.find(p => p.month === month).id);
  let slots = Array(12).fill(''), live = true;
  const cards = new Map();
  const title = element('h1', year + ' photo picker'), introduction = element('p', 'Assign one photo to each month. Download your choices before leaving or locking the workspace. You can restore a partial list later.');
  const guide = element('a', 'Photo picker guide'); guide.href = './calendar-guide/'; guide.target = '_blank'; guide.rel = 'noopener noreferrer';
  const restore = element('input'); restore.type = 'file'; restore.accept = '.txt,text/plain'; restore.className = 'calendar-import'; restore.hidden = true;
  const restored = element('p', '', 'muted'); restored.setAttribute('role', 'status');
  restore.addEventListener('change', async () => {
    const file = restore.files[0]; if (!file) return;
    try {
      if (file.size > 16384) throw Error('Too large');
      const receipt = await file.text(); if (!live) return;
      slots = restoreChoices(receipt, year, data.photos); update(); restored.textContent = 'Restored your month assignments.';
    } catch { if (live) restored.textContent = 'Choose a text list downloaded from this year’s photo picker.'; }
    restore.value = '';
  });
  const note = element('p', '', 'calendar-count'); note.setAttribute('role', 'status');
  const actions = element('div', '', 'calendar-actions'), filters = element('div', '', 'calendar-filters');
  const search = element('input'); search.type = 'search'; search.placeholder = 'Title, photo ID or month'; search.autocomplete = 'off';
  const sources = element('select'); sources.add(new Option('All sources', ''));
  for (const source of [...new Set(data.photos.map(p => p.source))].sort()) sources.add(new Option(source, source));
  const matches = element('span', '', 'muted'); matches.setAttribute('role','status');
  filters.append(labeled('Search photos', search), labeled('Source', sources), matches);
  const grid = element('div', '', 'calendar-grid');
  const modal = element('dialog', '', 'calendar-dialog');
  modal.setAttribute('aria-label', 'Photo picker details');
  const body = element('div');
  modal.append(control('Close', () => modal.close()), body);
  modal.addEventListener('close', () => { if (!modal.open) body.replaceChildren(); });
  function update() {
    for (const [id, card] of cards) card.assign.value = MONTHS[slots.indexOf(id)] || '';
    note.textContent = slots.filter(Boolean).length + ' of 12 months assigned';
  }
  function monthSelect(p) {
    const select = element('select'); select.setAttribute('aria-label', 'Assign ' + p.id + ' to month');
    select.add(new Option('Choose month', ''));
    for (const month of MONTHS) select.add(new Option(month, month));
    select.value = MONTHS[slots.indexOf(p.id)] || '';
    select.addEventListener('change', () => { slots = assignPhoto(slots, p.id, select.value); update(); });
    return select;
  }
  function fullView(p) {
    const image = element('img'); image.src = p.uri; image.alt = p.caption || p.title;
    const detail = element('p', (p.ppi < 150 ? 'Low resolution · ' : '') + p.ppi + ' ppi at 12 inches wide', p.ppi < 150 ? 'calendar-low' : '');
    const aliases = p.aliases.length ? ' · Also listed as ' + p.aliases.join(', ') : '';
    body.replaceChildren(image, element('p', p.id + aliases, 'eyebrow'), element('h2', p.title),
      element('p', p.caption), element('p', p.source, 'muted'), detail, labeled('Assign to month', monthSelect(p)));
    modal.showModal();
  }
  function review() {
    const count = slots.filter(Boolean).length;
    const receipt = [year + ' calendar choices (' + count + '/12)', ...MONTHS.map((month, i) => {
      const p = byID.get(slots[i]);
      return month + ' — ' + (p ? p.id + ' · ' + p.title : 'Unassigned');
    })].join('\n');
    const list = element('textarea'); list.value = receipt; list.readOnly = true; list.rows = 13;
    list.setAttribute('aria-label', 'Calendar choices by month');
    const feedback = element('p'); feedback.setAttribute('role', 'status');
    const tools = element('div', '', 'calendar-actions');
    if (navigator.share) tools.append(control('Share choices', async () => {
      try { await navigator.share({title: year + ' calendar choices', text: receipt}); }
      catch (error) { if (live && error.name !== 'AbortError') feedback.textContent = 'Sharing is unavailable. Copy or download your choices.'; }
    }, 'primary'));
    tools.append(control('Copy choices', async () => {
      list.focus(); list.select();
      try { await navigator.clipboard.writeText(receipt); if (live) feedback.textContent = 'Copied choices.'; }
      catch { if (live) feedback.textContent = 'Your choices are selected. Use your device’s Copy command.'; }
    }), control('Download text', () => saveText(receipt + '\n', 'calendar-' + year + '-choices.txt', 'text/plain')));
    body.replaceChildren(element('h2', 'Review choices'), element('p', count + ' of 12 months assigned. Share or download this list to keep it.'), list, tools, feedback);
    modal.showModal();
  }
  actions.append(control('Use proposed twelve', () => { slots = [...proposed]; update(); }),
    control('Restore choices', () => restore.click()), guide);
  const reviewBar = element('div', '', 'calendar-review-bar');
  reviewBar.append(note, control('Review choices', review, 'primary'));
  const ordered = [...proposed.map(id => byID.get(id)), ...data.photos.filter(p => !p.month)];
  for (const p of ordered) {
    const card = element('article', '', 'calendar-card');
    const image = element('img'); image.loading = 'lazy'; image.decoding = 'async'; image.alt = p.caption || p.title; image.src = p.uri;
    const zoom = control('', () => fullView(p), 'calendar-zoom'); zoom.append(image);
    zoom.setAttribute('aria-label', 'View ' + p.id + ', ' + p.title);
    const assign = monthSelect(p);
    card.append(element('p', p.id + (p.month ? ' · Proposed for ' + p.month : ' · Alternate'), 'eyebrow'),
      zoom, element('h3', p.title), element('p', p.source, 'muted'), assign);
    grid.append(card); cards.set(p.id, { card, assign });
  }
  function filter() {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const p of ordered) {
      const words = [p.id, ...p.aliases, p.title, p.caption, p.month, p.source].join(' ').toLowerCase();
      const visible = (!sources.value || sources.value === p.source) && terms.every(term => words.includes(term));
      cards.get(p.id).card.hidden = !visible;
      if (visible) shown++;
    }
    matches.textContent = shown + ' of ' + ordered.length + ' photos';
  }
  search.addEventListener('input', filter); sources.addEventListener('change', filter);
  target.replaceChildren(title, introduction, actions, restore, restored, filters, reviewBar, grid, modal); update(); filter();
  return () => {
    live = false; modal.close();
    for (const img of target.querySelectorAll('img')) img.removeAttribute('src');
    body.replaceChildren(); target.replaceChildren(); cards.clear(); byID.clear(); slots = [];
    // Release image strings even when a system share sheet still owns a pending promise.
    for (const p of ordered) p.uri = '';
    ordered.length = 0; data = null;
  };
}
