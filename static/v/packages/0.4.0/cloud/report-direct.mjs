#!/usr/bin/env node
// Sends only the status JSON supplied by the operator. Does not inspect the host.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FleetError, deviceIDPattern, validateReport, validateCredentials, saveReport } from './cloudkit.mjs';

async function boundedFile(filename, limit, secret = false) {
  const info = await stat(filename);
  if (!info.isFile() || info.size > limit) throw new FleetError('Input is not a regular file or exceeds its size limit');
  if (secret && process.platform !== 'win32' && (info.mode & 0o077)) throw new FleetError('Protect the profile and private key with chmod 600 before reporting');
  return readFile(filename, 'utf8');
}
export async function loadProfile(filename) {
  const profile = JSON.parse(await boundedFile(filename, 8192, true));
  if (!profile || !deviceIDPattern.test(profile.deviceId) || typeof profile.privateKeyFile !== 'string' || !profile.privateKeyFile)
    throw new FleetError('Invalid reporting profile');
  const privateKey = await boundedFile(path.resolve(path.dirname(filename), profile.privateKeyFile), 8192, true);
  const credentials = { container: profile.container, environment: profile.environment, keyID: profile.keyID, deviceId: profile.deviceId, privateKey };
  validateCredentials(credentials);
  return credentials;
}
export async function run(argv, { fetcher = fetch, now = Date.now() } = {}) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const option = argv[i];
    if (option === '--validate' && !options.validate) options.validate = true;
    else if (['--profile', '--report'].includes(option) && !options[option] && argv[i + 1] && !argv[i + 1].startsWith('--')) options[option] = argv[++i];
    else throw new FleetError('Usage: node report-direct.mjs --profile /private/reporter-profile.json --report status.json [--validate]');
  }
  if (!options['--profile'] || !options['--report']) throw new FleetError('Both --profile and --report are required');
  const credentials = await loadProfile(path.resolve(options['--profile']));
  const input = JSON.parse(await boundedFile(options['--report'], 8192));
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new FleetError('A status object is required');
  // Omit these two fields in a reusable status file; explicitly supplied values are checked.
  const report = validateReport({ ...input, deviceId: input.deviceId ?? credentials.deviceId,
    reportedAt: input.reportedAt ?? new Date(now).toISOString() }, credentials.deviceId, now);
  if (options.validate) return { validated: true, sent: false, deviceId: report.deviceId, container: credentials.container, environment: credentials.environment };
  return saveReport(report, credentials, { now, fetcher });
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await run(process.argv.slice(2)), null, 2)); }
  catch (error) {
    console.error(JSON.stringify({ error: error instanceof FleetError ? error.message : 'Unable to read valid report/profile files; check their paths, JSON and permissions' }));
    process.exitCode = 1;
  }
}
