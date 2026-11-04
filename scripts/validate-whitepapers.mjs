import { readFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'static/whitepapers');
const publicRoot = path.join(root, 'public');
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const manifest = await json(path.join(output, 'manifest.json'));
const manuscripts = await Promise.all((await readdir(path.join(root, 'data/whitepapers')))
  .filter(name => name.endsWith('.json')).map(name => json(path.join(root, 'data/whitepapers', name))));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const failures = [];
const validate = (condition, message) => { if (!condition) failures.push(message); };
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`))?.slice(1).find(v => v !== undefined);
const origin = 'https://www.orbitusrobotics.com';

validate(manifest.papers.length === manuscripts.length, 'Manifest/manuscript count differs.');
validate(new Set(manuscripts.map(p => p.id)).size === manuscripts.length, 'Duplicate paper identifier.');
for (const [name, expected] of Object.entries(manifest.artifacts)) {
  validate(!name.includes('..') && !path.isAbsolute(name), `Unsafe artifact path: ${name}`);
  const bytes = await readFile(path.join(output, name));
  validate(digest(bytes) === expected, `Artifact checksum mismatch: ${name}`);
}
for (const p of manuscripts) {
  const m = manifest.papers.find(entry => entry.id === p.id);
  if (!m) { failures.push(`Missing manifest entry: ${p.id}`); continue; }
  const pdf = await readFile(path.join(output, m.pdf));
  validate(pdf.subarray(0,5).toString() === '%PDF-', `${p.id}: invalid PDF header`);
  validate(digest(pdf) === m.sha256 && pdf.length === m.bytes, `${p.id}: PDF integrity mismatch`);
  const evidence = await readFile(path.join(output, `${p.slug}.evidence.json`));
  validate(digest(evidence) === m.evidence_sha256, `${p.id}: evidence integrity mismatch`);
  validate(!/\/Users\/|\/home\/amber\/|BEGIN .*PRIVATE KEY|password\s*=/.test(evidence.toString()), `${p.id}: private source path or credential pattern`);
  const pageFile = path.join(publicRoot, 'whitepapers', p.slug, 'index.html');
  const page = await readFile(pageFile, 'utf8');
  validate(page.includes(p.id) && page.includes('Not peer reviewed'), `${p.id}: identity or publication status missing`);
  const ids = new Set([...page.matchAll(/\bid=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/g)].map(m=>m[1]??m[2]??m[3]));
  for (let i=1; i<=p.references.length; i++) validate(ids.has(`ref-${i}`), `${p.id}: missing reference ${i}`);
  for (const s of p.sections) {
    for (const b of s.blocks) {
      const text = JSON.stringify(b);
      for (const match of text.matchAll(/\[(\d+(?:,\d+)*)\]/g)) {
        for (const n of match[1].split(',').map(Number)) validate(n>=1 && n<=p.references.length,`${p.id}: unresolved citation ${n}`);
      }
      if (b.kind==='figure') {
        validate(Boolean(b.alt?.trim()), `${p.id}: diagram lacks alt text`);
        validate(page.includes(`${b.name}.svg`), `${p.id}: figure missing from web edition`);
      }
    }
  }
  for (const tag of page.match(/<(?:a|img|link)\b[^>]*>/g)??[]) {
    const value = attr(tag,'href')??attr(tag,'src');
    if (!value || /^(mailto|tel):/.test(value)) continue;
    const target = new URL(value, `${origin}/whitepapers/${p.slug}/`);
    if (target.origin!==origin) continue;
    if (target.pathname===`/whitepapers/${p.slug}/` && target.hash) {
      validate(ids.has(decodeURIComponent(target.hash.slice(1))),`${p.id}: broken local anchor ${target.hash}`);
    }
    let local=path.join(publicRoot,decodeURIComponent(target.pathname));
    if (target.pathname.endsWith('/')) local=path.join(local,'index.html');
    try { await access(local); } catch { failures.push(`${p.id}: missing local target ${target.pathname}`); }
  }
  const schemaMatch = page.match(/<script type=(?:"application\/ld\+json"|application\/ld\+json)>([\s\S]*?)<\/script>/);
  validate(Boolean(schemaMatch),`${p.id}: structured article metadata missing`);
  if (schemaMatch) {
    const schema=JSON.parse(schemaMatch[1]);
    validate(schema.identifier===p.id && schema.encoding.contentUrl===`${origin}/whitepapers/${m.pdf}`,`${p.id}: metadata/PDF disagreement`);
  }
  validate(page.includes('Evidence summary (JSON)') && page.includes('Citation file (BibTeX)'),`${p.id}: supporting links missing`);
}
const ledger=await json(path.join(output,'amber-library-ledger.json'));
validate(ledger.libraries.length===42 && ledger.libraries.filter(l=>l.linkage==='Direct').length===7,'Library ledger does not match the recorded 42/7 inventory.');
const home=await readFile(path.join(publicRoot,'index.html'),'utf8');
const hub=await readFile(path.join(publicRoot,'whitepapers/index.html'),'utf8');
for (const p of manuscripts) {
  validate(home.includes(`/whitepapers/${p.slug}/`) && hub.includes(`/whitepapers/${p.slug}/`),`${p.id}: missing home/hub discovery link`);
}
if (failures.length) {
  console.error(failures.join('\n'));process.exit(1);
}
console.log(`White-paper validation passed: ${manuscripts.length} editions, ${Object.keys(manifest.artifacts).length} hashed artifacts, complete citations and local links, 42-library ledger.`);
