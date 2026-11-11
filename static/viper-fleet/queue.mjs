import { check, uuid, from64, filename, sha256, seal, unseal, validateDescriptor, blobName, validateBundle, fleetLimits } from './queue-format.mjs';

export function validateKeys(value, config) {
  check(value?.version === 1 && value.container === config.container && value.environment === config.environment
    && !value.privateKeyPEM && Array.isArray(value.devices) && value.devices.length > 0 && value.devices.length <= 1000, 'Choose command-keys.json for this container and environment. Keep the server private key out of the browser.');
  const ids = new Set();
  for (const d of value.devices) { check(uuid.test(d.deviceId) && d.deviceId === d.deviceId.toLowerCase() && !ids.has(d.deviceId)
    && typeof d.name === 'string' && d.name.length && d.name.length <= 80 && from64(d.commandKey).length === 32, 'Invalid or duplicate enrolled machine'); ids.add(d.deviceId); }
  return value.devices;
}
export function checkedRecords(response) {
  check(response && !response.hasErrors && !response.errors?.length && Array.isArray(response.records)
    && response.records.every(r => !r.serverErrorCode), 'CloudKit did not confirm access or the queue operation'); return response.records;
}
export function attachQueue({ database, configuration, authorized }) {
  const $ = id => document.getElementById(id);
  let devices = [], bundle, busy = false, generation = 0, urls = [];
  const notice = message => { $('queue-status').textContent = message; };
  function render() {
    if (configuration()?.enabled && configuration()?.commandsEnabled !== true)
      notice('Command delivery is staged. Your administrator must activate the queue schema before submissions are enabled.');
    $('queue-submit').disabled = busy || !authorized() || !bundle || !devices.length;
    $('queue-refresh').disabled = busy || !authorized() || !devices.length;
    $('queue-target').disabled = busy; $('queue-keys').disabled = busy || !authorized(); $('queue-payload').disabled = busy || !authorized();
  }
  function clear() {
    generation++; devices = []; bundle = undefined; busy = false;
    $('queue-target').replaceChildren(new Option('Import your command keys first', ''));
    $('queue-keys').value = ''; $('queue-payload').value = ''; $('queue-preview').textContent = '';
    $('queue-jobs').replaceChildren(); $('queue-receipt').textContent = ''; $('queue-downloads').replaceChildren();
    urls.forEach(url => URL.revokeObjectURL(url)); urls = [];
    notice('Sign in, then import your private command-keys.json and a ViperLink payload export. Keys remain in this page’s memory.'); render();
  }
  function context() {
    check(authorized(), 'Sign in with fleet access first'); const device = devices.find(d => d.deviceId === $('queue-target').value);
    check(device, 'Choose an enrolled machine'); const current = generation;
    return { device, db: database(), current, guard() { check(current === generation && authorized(), 'Session changed; refresh the queue to check any pending submission'); } };
  }
  async function create(ctx, record) {
    ctx.guard(); const response = await ctx.db.newRecordsBatch().create(record).commit(); ctx.guard();
    const r = checkedRecords(response)[0]; check(r?.recordName === record.recordName && r.recordChangeTag, 'Queue write was not acknowledged'); return r;
  }
  async function lookup(ctx, name) {
    ctx.guard(); const r = checkedRecords(await ctx.db.fetchRecords(name))[0]; ctx.guard(); check(r?.recordName === name, 'Queue record unavailable'); return r;
  }
  async function guarded(action) {
    if (busy) return; busy = true; render();
    try { await action(); } catch (e) { notice(e.message || 'Cloud operation failed. Refresh before retrying.'); }
    finally { busy = false; render(); }
  }
  $('queue-keys').addEventListener('change', () => guarded(async () => {
    devices = []; $('queue-target').replaceChildren(new Option('Import your command keys first', '')); $('queue-jobs').replaceChildren();
    check(authorized(), 'Sign in first'); const file = $('queue-keys').files[0]; check(file && file.size <= 1048576, 'Command key file is too large');
    const current = generation, parsed = JSON.parse(await file.text()); check(current === generation && authorized(), 'Sign-in changed');
    devices = validateKeys(parsed, configuration()); $('queue-target').replaceChildren(...devices.map(d => new Option(d.name, d.deviceId)));
    notice(`${devices.length} enrolled machines loaded. Choose a target and payload.`);
  }));
  $('queue-payload').addEventListener('change', () => guarded(async () => {
    bundle = undefined; $('queue-preview').textContent = '';
    check(authorized(), 'Sign in first'); const file = $('queue-payload').files[0]; check(file && file.size <= fleetLimits.bundleBytes, 'Payload export must be at most 16 MiB');
    const current = generation, parsed = await validateBundle(JSON.parse(await file.text())); check(current === generation && authorized(), 'Sign-in changed'); bundle = parsed;
    $('queue-preview').textContent = `${bundle.plan.name}\n${bundle.plan.steps.map((s, i) => `${i + 1}. ${s.kind === 'command' ? `Command (${s.timeout}s): ${s.command}` : `${s.kind === 'upload' ? 'Send' : 'Receive'}: ${s.remoteName}`}`).join('\n')}`;
    notice('Review the target and ordered steps, then queue this payload.');
  }));
  $('queue-submit').addEventListener('click', () => guarded(async () => {
    const ctx = context(), jobId = crypto.randomUUID(), now = Date.now(), hours = Number($('queue-expiry').value);
    check(Number.isInteger(hours) && hours >= 1 && hours <= 168 && bundle, 'Choose a payload and an expiry of 1–168 hours');
    await validateBundle(bundle); ctx.guard();
    const request = { version: 1, deviceId: ctx.device.deviceId, jobId, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + hours * 3600000).toISOString(), bundle };
    notice(`Encrypting payload for ${ctx.device.name}…`);
    const message = await seal(request, ctx.device.commandKey, 'request', ctx.device.deviceId, jobId);
    for (let i = 0; i < message.chunks.length; i++) {
      notice(`Uploading encrypted part ${i + 1} of ${message.chunks.length}…`);
      await create(ctx, { recordType: 'ViperFleetBlob', recordName: blobName(jobId, 'request', i, message.descriptor.sha256), fields: {
        deviceId: { value: ctx.device.deviceId }, jobId: { value: jobId }, data: { value: message.chunks[i] } } });
    }
    await create(ctx, { recordType: 'ViperFleetCommand', recordName: `job-${jobId}`, fields: {
      deviceId: { value: ctx.device.deviceId }, jobId: { value: jobId }, createdAt: { value: now, type: 'TIMESTAMP' },
      status: { value: 'queued' }, requestJSON: { value: JSON.stringify(message.descriptor) }, resultJSON: { value: '' } } });
    notice(`Queued ${bundle.plan.name} for ${ctx.device.name}. Job ${jobId}. Execution awaits its next check-in; expires ${new Date(request.expiresAt).toLocaleString()}.`);
    try { await refresh(ctx); }
    catch { ctx.guard(); notice(`Job ${jobId} was queued, but refreshing the list failed. Refresh to check it; do not resubmit.`); }
  }));
  async function refresh(ctx) {
    ctx.guard(); const records = checkedRecords(await ctx.db.performQuery({ recordType: 'ViperFleetCommand', filterBy: [
      { fieldName: 'deviceId', comparator: 'EQUALS', fieldValue: { value: ctx.device.deviceId } }], sortBy: [{ fieldName: 'createdAt', ascending: false }] }, { resultsLimit: 100 }));
    ctx.guard(); $('queue-jobs').replaceChildren();
    for (const record of records) {
      const f = record.fields, job = f?.jobId?.value; check(uuid.test(job) && f?.deviceId?.value === ctx.device.deviceId, 'Unexpected queue record');
      const item = document.createElement('article'), label = document.createElement('p'), button = document.createElement('button'); item.className = 'queue-job';
      label.textContent = `${new Date(f.createdAt?.value).toLocaleString()} · ${job} · Queue status: ${f.status?.value || 'unknown'}`;
      button.textContent = 'Verify receipt'; button.addEventListener('click', () => guarded(() => receipt(context(), job)));
      item.append(label, button); $('queue-jobs').append(item);
    }
    if (!records.length) $('queue-jobs').textContent = 'No queued jobs for this machine.';
  }
  async function receipt(ctx, job) {
    const r = await lookup(ctx, `job-${job}`); check(r.fields?.deviceId?.value === ctx.device.deviceId, 'Receipt target mismatch');
    const text = r.fields?.resultJSON?.value; check(typeof text === 'string' && text.length > 0 && text.length < 2048, 'Awaiting a device-authenticated receipt. Queued does not mean executed.');
    const d = validateDescriptor(JSON.parse(text)), chunks = [];
    for (let i = 0; i < d.chunks; i++) { const blob = await lookup(ctx, blobName(job, 'result', i, d.sha256)); const data = blob.fields?.data?.value; check(typeof data === 'string' && data.length <= 350000, 'Invalid receipt chunk'); chunks.push(data); }
    const value = await unseal(d, chunks, ctx.device.commandKey, 'result', ctx.device.deviceId, job); ctx.guard();
    check(value.version === 1 && value.jobId === job && value.deviceId === ctx.device.deviceId && Array.isArray(value.steps), 'Receipt identity mismatch');
    $('queue-downloads').replaceChildren(); urls.forEach(url => URL.revokeObjectURL(url)); urls = []; let total = 0;
    for (const s of value.steps) if (s.kind === 'download' && s.data) {
      filename(s.name); const data = from64(s.data); total += data.length; check(total <= fleetLimits.fileBytes && s.sha256 === await sha256(data), 'Returned file checksum mismatch'); ctx.guard();
      const url = URL.createObjectURL(new Blob([data])); urls.push(url); const a = document.createElement('a'); a.href = url; a.download = s.name; a.textContent = `Download ${s.name} (${data.length} bytes)`; $('queue-downloads').append(a); delete s.data;
    }
    $('queue-receipt').textContent = JSON.stringify(value, null, 2); notice(`Authenticated receipt: ${value.status}.`);
  }
  $('queue-refresh').addEventListener('click', () => guarded(() => refresh(context())));
  $('queue-target').addEventListener('change', () => { $('queue-jobs').replaceChildren(); $('queue-receipt').textContent = ''; });
  clear(); return { clear, render };
}
