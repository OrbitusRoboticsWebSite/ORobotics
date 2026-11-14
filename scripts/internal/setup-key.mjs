#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { mkdir, writeFile, access, realpath } from 'node:fs/promises';
import path from 'node:path';
try {
  const destination = process.argv[2]; if (!destination || !path.isAbsolute(destination)) throw new Error('Choose a new absolute private directory outside Git');
  for (let p = await realpath(path.dirname(destination)); ; p = path.dirname(p)) {
    let inGit = false; try { await access(path.join(p, '.git')); inGit = true; } catch {}
    if (inGit) throw new Error('Keep keys outside Git'); if (path.dirname(p) === p) break;
  }
  await mkdir(destination, { mode: 0o700 });
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const write = (name, data) => writeFile(path.join(destination, name), data, { mode: 0o600, flag: 'wx' });
  await write('internal-private.pem', privateKey.export({ type: 'pkcs8', format: 'pem' }));
  await write('internal-public.pem', publicKey.export({ type: 'spki', format: 'pem' }));
  await write('profile.json', JSON.stringify({ container: 'iCloud.orbitusrobotics.Internal', environment: 'production', teamID: '', keyID: '', expectedAdminRecordName: '', apiToken: '', privateKeyFile: 'internal-private.pem' }, null, 2) + '\n');
  console.log('Prepared local key material. Register only internal-public.pem in the new container; no credential has been activated.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
