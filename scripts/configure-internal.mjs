import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateConfig } from '../static/internal/core.mjs';
export function internalConfig(env) {
  const config = { enabled: false, container: 'iCloud.orbitusrobotics.Internal', environment: 'production', apiToken: '' };
  if (env.ORBITUS_INTERNAL_ENABLED !== 'true') return config;
  if (env.ORBITUS_INTERNAL_ACCESS_VERIFIED !== 'true') throw new Error('Complete production access verification before enabling the workspace');
  return validateConfig({ ...config, enabled: true, apiToken: env.ORBITUS_INTERNAL_API_TOKEN });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = internalConfig(process.env);
  await writeFile('public/internal/config.json', JSON.stringify(config, null, 2) + '\n');
  console.log(`Orbitus Internal: ${config.enabled ? 'employee sign-in configured' : 'setup pending; private content unavailable'}`);
}
