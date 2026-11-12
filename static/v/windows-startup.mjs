// Machine startup host. Installed explicitly through the Windows administrator
// installer; runs as LocalService. No enrollment or commands are enabled here.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export async function runMachineReceiver({ data, component, signal, load, check, wait = delay }) {
  const profileFile = path.join(data, 'receiver.json');
  const statusFile = path.join(data, 'startup-status.json');
  if (!load || !check) {
    const receiver = await import(pathToFileURL(path.join(component, 'queue-agent.mjs')));
    load = receiver.loadReceiver; check = receiver.checkIn;
  }
  await mkdir(data, { recursive: true });
  while (!signal.aborted) {
    let interval = 60_000;
    let state = { status: 'waiting-for-enrollment', pid: process.pid, updatedAt: new Date().toISOString() };
    try {
      const profile = await load(profileFile);
      interval = profile.intervalMinutes * 60_000;
      if (!profile.enabled) { state.status = 'disabled'; interval = 5_000; }
      else {
        await check(profileFile, { signal });
        state.status = 'checked-in';
      }
    } catch (error) {
      // Keep credentials, command output, and private paths out of this summary.
      state.status = error.code === 'ENOENT' ? 'waiting-for-enrollment' : 'check-in-failed';
    }
    if (signal.aborted) break;
    const temp = statusFile + '.' + process.pid + '.tmp';
    await writeFile(temp, JSON.stringify(state) + '\n', { mode: 0o600 });
    await rename(temp, statusFile);
    // Re-read a changed profile promptly, including enabled and intervalMinutes.
    let before; try { before = await readFile(profileFile, 'utf8'); } catch {}
    const start = Date.now();
    while (!signal.aborted && Date.now() - start < interval) {
      try { await wait(Math.min(5_000, interval - (Date.now() - start)), undefined, { signal }); }
      catch (error) { if (error.name !== 'AbortError') throw error; }
      let after; try { after = await readFile(profileFile, 'utf8'); } catch {}
      if (after !== before) break;
    }
  }
}

async function main(argv) {
  if (argv.length !== 4 || argv[0] !== '--data' || argv[2] !== '--component' ||
      !path.isAbsolute(argv[1]) || !path.isAbsolute(argv[3])) {
    throw new Error('Usage: node windows-startup.mjs --data ABSOLUTE_DIRECTORY --component ABSOLUTE_DIRECTORY');
  }
  const abort = new AbortController();
  process.once('SIGINT', () => abort.abort()); process.once('SIGTERM', () => abort.abort());
  await runMachineReceiver({ data: argv[1], component: argv[3], signal: abort.signal });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => { console.error('ViperLink startup failed; inspect the protected installation and enrollment.'); process.exitCode = 1; });
}
