import { randomUUID } from 'node:crypto';
import { lstat, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCalendar } from '../../static/internal/calendar.mjs';
import { MAX_FILE_BYTES } from '../../static/internal/core.mjs';

const [yearText, source, destination] = process.argv.slice(2);
if (!/^\d{4}$/.test(yearText ?? '') || !source || !destination) {
  throw new Error('Usage: node scripts/internal/prepare-calendar.mjs YEAR PICKER_HTML_OR_JSON PRIVATE_OUTPUT_DIRECTORY');
}
const year = Number(yearText);
const project = fileURLToPath(new URL('../../', import.meta.url));
const directory = await realpath(destination);
for (let ancestor = directory; ; ancestor = path.dirname(ancestor)) {
  const gitMarker = await lstat(path.join(ancestor, '.git')).catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (gitMarker || ancestor === path.resolve(project)) {
    throw new Error('Choose a private output directory outside all Git working trees and the website project');
  }
  if (ancestor === path.dirname(ancestor)) break;
}
const input = await readFile(source, 'utf8');
let records;
if (path.extname(source).toLowerCase() === '.html') {
  const tag = '<script type="application/json" id="photoData">';
  const start = input.indexOf(tag);
  const end = input.indexOf('</script>', start + tag.length);
  if (start < 0 || end < 0 || input.indexOf(tag, start + tag.length) >= 0) {
    throw new Error('Expected one embedded photoData block in the approved offline picker');
  }
  records = JSON.parse(input.slice(start + tag.length, end));
} else {
  const parsed = JSON.parse(input);
  if (parsed.year !== undefined && parsed.year !== year) throw new Error('Source year does not match requested year');
  records = Array.isArray(parsed) ? parsed : parsed.photos;
}
if (!Array.isArray(records)) throw new Error('Expected an array of photo choices');
// Strip private metadata segments without resampling the approved photograph.
function approvedJPEG(uri) {
  const prefix = 'data:image/jpeg;base64,';
  if (typeof uri !== 'string' || !uri.startsWith(prefix) || uri.length > 2_800_000) {
    throw new Error('Expected an inline JPEG preview');
  }
  const bytes = Buffer.from(uri.slice(prefix.length), 'base64');
  if (bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) throw new Error('Invalid JPEG');
  const parts = [bytes.subarray(0, 2)];
  for (let i = 2; i + 4 <= bytes.length;) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xda) {
      parts.push(bytes.subarray(i));
      return prefix + Buffer.concat(parts).toString('base64');
    }
    const length = bytes.readUInt16BE(i + 2);
    const end = i + 2 + length;
    if (length < 2 || end > bytes.length) break;
    if (marker !== 0xfe && (marker < 0xe1 || marker > 0xef)) parts.push(bytes.subarray(i, end));
    i = end;
  }
  throw new Error('Unsupported JPEG marker sequence');
}

const photos = records.map(({ id, title, caption, source, month, ppi, print_ppi, aliases, uri }) =>
  ({ id, title, caption, source, month, ppi: ppi ?? print_ppi, aliases, uri: approvedJPEG(uri) }));
const catalog = validateCalendar({ schemaVersion: 1, year, photos }, year);
const bytes = Buffer.from(JSON.stringify(catalog));
if (bytes.length > MAX_FILE_BYTES) throw new Error('Calendar package exceeds the internal document size limit');
const filename = 'photo-picker-' + year + '.json';
const temporary = path.join(directory, '.' + randomUUID() + '.tmp');
await writeFile(temporary, bytes, { mode: 0o600, flag: 'wx' });
await rename(temporary, path.join(directory, filename));
console.log('Prepared %s with %d choices and %d bytes.', filename, photos.length, bytes.length);
