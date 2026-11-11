import { writeFile } from 'node:fs/promises';
export function fleetConfig(env) {
  const config = { enabled: false, container: 'iCloud.com.orbitusrobotics.ViperLink', environment: 'production', apiToken: '', intakeURL: '' };
  if (env.VIPER_FLEET_ENABLED !== 'true') return config;
  const { VIPER_FLEET_CONTAINER: container, VIPER_FLEET_ENVIRONMENT: environment, VIPER_FLEET_API_TOKEN: apiToken, VIPER_FLEET_INTAKE_URL: intakeURL } = env;
  if (!/^iCloud\.[A-Za-z0-9.-]+$/.test(container || '') || !['production', 'development'].includes(environment) || typeof apiToken !== 'string' || !apiToken.trim()) throw new Error('Viper Fleet cloud configuration is incomplete');
  const url = new URL(intakeURL);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/v1/check-in' || !/^[A-Za-z0-9.-]+$/.test(url.hostname)) throw new Error('Viper Fleet intake must be an HTTPS check-in endpoint');
  return { enabled: true, container, environment, apiToken, intakeURL: url.href };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const config = fleetConfig(process.env);
  await writeFile('public/viper-fleet/config.json', JSON.stringify(config, null, 2) + '\n');
  console.log(`Viper Fleet: ${config.enabled ? 'cloud connection configured; live permission testing still required' : 'inactive staging preview'}`);
}
