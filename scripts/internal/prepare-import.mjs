#!/usr/bin/env node
// This command prepares a PRIVATE package, never a static website asset.
import { readFile, writeFile, access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { packageDocument, validateCatalog } from '../../static/internal/core.mjs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => { if (v.startsWith('--')) a.push([v.slice(2), all[i + 1]]); return a; }, []));
try {
  for (const k of ['catalog','files','output']) if (!args[k] || !path.isAbsolute(args[k])) throw new Error('Use absolute --catalog, --files and --output paths');
  for (let p = await realpath(path.dirname(args.output)); ; p = path.dirname(p)) {
    let inGit = false; try { await access(path.join(p, '.git')); inGit = true; } catch {}
    if (inGit) throw new Error('Private import packages must stay outside Git'); if (path.dirname(p) === p) break;
  }
  const catalog = validateCatalog(JSON.parse(await readFile(args.catalog, 'utf8')));
  const files = JSON.parse(await readFile(args.files, 'utf8')); if (!Array.isArray(files) || files.length > 100) throw new Error('Invalid private file manifest');
  const records = [];
  for (const file of files) {
    if (!path.isAbsolute(file.path)) throw new Error('Source file paths must be absolute');
    const { path: source, ...metadata } = file;
    const packaged = await packageDocument(new Uint8Array(await readFile(source)), metadata);
    catalog.documents.push(packaged.document); records.push(...packaged.records);
  }
  validateCatalog(catalog);
  await writeFile(args.output, JSON.stringify({ schemaVersion: 1, container: 'iCloud.orbitusrobotics.Internal', catalog, records }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Prepared a private import with ${catalog.documents.length} documents and ${records.length} chunks. Nothing uploaded.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
