#!/usr/bin/env node
// Visible, explicitly enabled receiver. No installation, privilege escalation,
// login item, network listener, or automatic replay after uncertain execution.
import { readFile, lstat, mkdir, open, rename, unlink, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadProfile } from './report-direct.mjs';
import { saveReport } from './cloudkit.mjs';
import { FleetCloud, getMessage, putMessage } from './queue-cloud.mjs';
import { check, uuid, intervalMinutes, from64, bytes64, sha256, fleetLimits, validateBundle, validateRequest, unseal, seal } from './queue-format.mjs';

export async function privateJSON(file, limit = 48 * 1024 * 1024) {
  const st = await lstat(file); check(st.isFile() && !st.isSymbolicLink() && st.size <= limit, 'Expected a bounded regular profile/journal file');
  check(process.platform === 'win32' || !(st.mode & 0o077), 'Protect fleet files with chmod 600');
  return JSON.parse(await readFile(file, 'utf8'));
}
export async function durableJSON(file, value) {
  const temp = file + '.' + crypto.randomUUID() + '.tmp';
  const handle = await open(temp, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(value)); await handle.sync(); } finally { await handle.close(); }
  await rename(temp, file);
  // Directory fsync makes the rename durable on systems that support it.
  if (process.platform !== 'win32') { const dir = await open(path.dirname(file), 'r'); try { await dir.sync(); } finally { await dir.close(); } }
}
async function missingJSON(file) { try { return await privateJSON(file); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } }
export async function loadReceiver(file) {
  const profile = await privateJSON(file, 16384); intervalMinutes(profile.intervalMinutes);
  check(uuid.test(profile.deviceId) && from64(profile.commandKey).length === 32 && typeof profile.enabled === 'boolean'
    && typeof profile.root === 'string' && path.isAbsolute(profile.root), 'Invalid enrolled receiver profile');
  return { ...profile, credentials: await loadProfile(file), directory: path.dirname(file) };
}
function terminateTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
}
export async function commandStep(step, root, signal) {
  check(!signal?.aborted, 'Receiver stopped');
  return new Promise(resolve => {
    const shell = process.platform === 'win32' ? (process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe') : process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh';
    // Match Node's CMD shell quoting: /s strips the outer quotes, while the
    // command's own quotes must reach CMD unchanged (not C-runtime escaped).
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', `"${step.command}"`] : process.platform === 'darwin' ? ['-f', '-c', step.command] : ['-c', step.command];
    // Do not forward CloudKit credentials or unrelated application environment.
    const env = { PATH: process.env.PATH || '/usr/bin:/bin', HOME: os.homedir(), USER: os.userInfo().username,
      LANG: 'en_US.UTF-8', TMPDIR: os.tmpdir(), ...(process.platform === 'win32' ? { SystemRoot: process.env.SystemRoot, TEMP: os.tmpdir(), USERPROFILE: os.homedir() } : {}) };
    const child = spawn(shell, args, { cwd: root, env, detached: process.platform !== 'win32', windowsHide: true,
      windowsVerbatimArguments: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    const parts = []; let size = 0, reason = '', finished = false;
    const stop = text => { if (!reason) reason = text; terminateTree(child); };
    const abort = () => stop('Receiver stopped'); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(() => stop('Command timed out'), step.timeout * 1000);
    const output = data => {
      const room = fleetLimits.outputBytes - size;
      if (room > 0) { const slice = data.subarray(0, room); parts.push(slice); size += slice.length; }
      if (data.length > room) stop('Command output exceeded 64 KiB');
    };
    child.stdout.on('data', output); child.stderr.on('data', output);
    const finish = (code, error) => {
      if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); terminateTree(child);
      resolve({ kind: 'command', exit: code ?? -1, output: Buffer.concat(parts).toString('utf8'), error: reason || error || null });
    };
    child.on('error', () => finish(-1, 'Unable to start the configured shell'));
    child.on('close', (code, sig) => finish(code, sig ? `Terminated (${sig})` : null));
    // Kill descendants when the shell exits so inherited pipes cannot hang us.
    child.on('exit', () => terminateTree(child));
  });
}
export async function executeBundle(bundle, root, { signal, checkpoint = async () => {}, execute = commandStep } = {}) {
  await validateBundle(bundle);
  const st = await lstat(root); check(st.isDirectory() && !st.isSymbolicLink() && await realpath(root) === path.resolve(root), 'Shared folder must be a real directory without symlink components');
  const results = []; let downloadBytes = 0, outputBytes = 0;
  for (const [index, step] of bundle.plan.steps.entries()) {
    check(!signal?.aborted, 'Receiver stopped'); await checkpoint(index, results);
    let r;
    try {
      if (step.kind === 'command') r = await execute(step, root, signal);
      else if (step.kind === 'upload') {
        const file = bundle.files[step.file], data = from64(file.data);
        const destination = path.join(root, step.remoteName);
        const handle = await open(destination, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW || 0), 0o600);
        try { await handle.writeFile(data); await handle.sync(); } finally { await handle.close(); }
        r = { kind: 'upload', name: step.remoteName, bytes: data.length, sha256: file.sha256 };
      } else {
        const source = path.join(root, step.remoteName), info = await lstat(source);
        check(info.isFile() && !info.isSymbolicLink() && downloadBytes + info.size <= fleetLimits.fileBytes, 'Downloads must be regular shared-folder files totaling at most 8 MiB');
        const handle = await open(source, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); let data;
        try { const actual = await handle.stat(); check(actual.isFile() && actual.size <= fleetLimits.fileBytes - downloadBytes, 'Download changed or exceeds limit');
          data = Buffer.alloc(actual.size); const { bytesRead } = await handle.read(data, 0, data.length, 0); check(bytesRead === data.length, 'Download changed while reading');
        } finally { await handle.close(); }
        downloadBytes += data.length;
        r = { kind: 'download', name: step.remoteName, bytes: data.length, sha256: await sha256(data), data: bytes64(data) };
      }
    } catch (e) { r = { kind: step.kind, error: e.code === 'EEXIST' ? 'Destination exists; it was not overwritten' : e.message }; }
    r.index = index; r.stepId = step.id; results.push(r);
    outputBytes += Buffer.byteLength(r.output || '');
    if (r.error || (step.kind === 'command' && r.exit !== 0)) return { status: 'failed', steps: results };
    if (outputBytes > 1024 * 1024) return { status: 'failed', steps: results, error: 'Payload output exceeded 1 MiB' };
  }
  return { status: 'succeeded', steps: results };
}
async function lockDirectory(directory) {
  const file = path.join(directory, 'receiver.lock');
  try { const h = await open(file, 'wx', 0o600); await h.writeFile(JSON.stringify({ pid: process.pid })); await h.close(); }
  catch (e) {
    if (e.code !== 'EEXIST') throw e;
    const old = await privateJSON(file, 1024); check(Number.isInteger(old.pid) && old.pid > 0, 'Invalid receiver lock; inspect it manually');
    let alive = true; try { process.kill(old.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
    check(!alive, 'Another receiver is already running for this profile'); await unlink(file); return lockDirectory(directory);
  }
  return async () => { await unlink(file); };
}
export async function processJob(cloud, profile, record, { signal, execute = commandStep } = {}) {
  const jobId = record.fields?.jobId?.value, deviceId = profile.deviceId;
  check(uuid.test(jobId) && record.recordName === `job-${jobId}` && record.fields?.deviceId?.value === deviceId, 'Malformed queue identity');
  const journalFile = path.join(profile.directory, 'journal', jobId + '.json');
  let journal = await missingJSON(journalFile);
  if (!journal) {
    if (record.fields.status?.value !== 'queued') return { skipped: true };
    const message = await getMessage(cloud, record.fields.requestJSON?.value, jobId, 'request');
    const request = await unseal(message.descriptor, message.chunks, profile.commandKey, 'request', deviceId, jobId);
    // Authentication and all file digests are checked before any command or write.
    let rejection;
    try { validateRequest(request, deviceId, jobId); await validateBundle(request.bundle); }
    catch (e) { rejection = e.message; }
    journal = { version: 1, jobId, deviceId, status: rejection === 'Job expired' ? 'expired' : rejection ? 'rejected' : 'claimed',
      startedAt: new Date().toISOString(), steps: [], requestHash: message.descriptor.sha256 };
    await durableJSON(journalFile, journal);
    if (rejection) {
      journal.error = rejection; journal.finishedAt = new Date().toISOString(); await durableJSON(journalFile, journal);
    } else {
    try { record = await cloud.save({ ...record, fields: { ...record.fields, status: { value: 'running' } } }); }
    catch (e) { journal.status = 'interrupted'; journal.error = 'Cloud claim was not confirmed; no steps were executed'; await durableJSON(journalFile, journal); throw e; }
    journal.status = 'running'; await durableJSON(journalFile, journal);
    try {
      const outcome = await executeBundle(request.bundle, profile.root, { signal, execute, checkpoint: async (index, steps) => {
        journal.currentStep = index; journal.steps = steps; await durableJSON(journalFile, journal);
      } }); Object.assign(journal, outcome);
    } catch (e) { journal.status = 'interrupted'; journal.error = e.message; }
    journal.finishedAt = new Date().toISOString(); await durableJSON(journalFile, journal);
    }
  } else {
    check(journal.version === 1 && journal.deviceId === deviceId && journal.jobId === jobId, 'Journal identity mismatch');
    if (['claimed', 'running'].includes(journal.status)) {
      journal.status = 'interrupted'; journal.error = 'Previous execution ended without a final receipt. Review it; this job will never be replayed.';
      journal.finishedAt = new Date().toISOString(); await durableJSON(journalFile, journal);
    }
    if (journal.receiptPublished) return { skipped: true, status: journal.status };
  }
  if (!journal.encryptedResult) {
    journal.encryptedResult = await seal({ version: 1, jobId, deviceId, status: journal.status, startedAt: journal.startedAt,
      finishedAt: journal.finishedAt || new Date().toISOString(), steps: journal.steps, error: journal.error || null }, profile.commandKey, 'result', deviceId, jobId);
    await durableJSON(journalFile, journal);
  }
  const resultJSON = await putMessage(cloud, journal.encryptedResult, deviceId, jobId, 'result');
  const latest = await cloud.lookup(record.recordName); check(latest, 'Job disappeared before its receipt could be published');
  await cloud.save({ ...latest, fields: { ...latest.fields, status: { value: journal.status }, resultJSON: { value: resultJSON } } });
  journal.receiptPublished = true; await durableJSON(journalFile, journal);
  return { jobId, status: journal.status, receiptPublished: true };
}
export async function checkIn(profileFile, { signal, cloud: suppliedCloud, execute, report = true } = {}) {
  const profile = await loadReceiver(profileFile); check(profile.enabled, 'Cloud commands are disabled in this receiver profile');
  await mkdir(path.join(profile.directory, 'journal'), { recursive: true, mode: 0o700 });
  const unlock = await lockDirectory(profile.directory);
  try {
    const cloud = suppliedCloud || new FleetCloud(profile.credentials);
    cloud.signal = signal;
    if (report) await saveReport({ schemaVersion: 1, deviceId: profile.deviceId, hostLabel: profile.name || os.hostname(),
      os: { family: process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux', flavor: os.type(), version: os.release(), architecture: os.arch() },
      agentVersion: '0.4.0', reportedAt: new Date().toISOString(), health: 'unknown', summary: { installedApps: 0, potentialVulnerabilities: 0 },
      tags: ['cloud-commands', 'inventory-not-run'], ...(profile.enrollment ? { enrollment: profile.enrollment } : {}) }, profile.credentials, { fetcher: (url, options) => fetch(url, {
        ...options, signal: signal ? AbortSignal.any([signal, options.signal]) : options.signal }) });
    const outcomes = []; let processed = 0;
    for (const record of await cloud.jobs(profile.deviceId)) {
      if (signal?.aborted) break;
      try { const result = await processJob(cloud, profile, record, { signal, execute }); if (!result.skipped) { outcomes.push(result); processed++; } }
      catch (e) { if (outcomes.length < 20) outcomes.push({ jobId: record.fields?.jobId?.value, status: 'rejected', error: e.message }); }
      if (processed >= 10) break;
    }
    return { checkedInAt: new Date().toISOString(), deviceId: profile.deviceId, intervalMinutes: profile.intervalMinutes, outcomes };
  } finally { await unlock(); }
}
export async function main(argv) {
  check(argv.length === 3 && argv[0] === '--profile' && ['--once', '--watch'].includes(argv[2]), 'Usage: node queue-agent.mjs --profile /private/receiver.json --once|--watch');
  const file = path.resolve(argv[1]), abort = new AbortController();
  process.once('SIGINT', () => abort.abort()); process.once('SIGTERM', () => abort.abort());
  do {
    let profile = await loadReceiver(file); if (!profile.enabled) { console.log(JSON.stringify({ status: 'disabled' })); return; }
    try { console.log(JSON.stringify(await checkIn(file, { signal: abort.signal }))); }
    catch (e) { console.log(JSON.stringify({ status: 'check-in-failed', error: e.message })); if (argv[2] === '--once') process.exitCode = 1; }
    if (argv[2] === '--once' || abort.signal.aborted) break;
    const start = Date.now();
    // Re-read settings each second so Stop and interval changes take effect promptly.
    while (!abort.signal.aborted) {
      profile = await loadReceiver(file); if (!profile.enabled || Date.now() - start >= profile.intervalMinutes * 60000) break;
      try { await unlink(path.join(path.dirname(file), 'check-now')); break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
      await new Promise(resolve => { const timer = setTimeout(done, 1000); function done() { clearTimeout(timer); abort.signal.removeEventListener('abort', done); resolve(); } abort.signal.addEventListener('abort', done, { once: true }); });
    }
  } while (!abort.signal.aborted);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(() => { console.error(JSON.stringify({ error: 'Receiver could not start; check its private profile, Node version and file permissions' })); process.exitCode = 1; });
