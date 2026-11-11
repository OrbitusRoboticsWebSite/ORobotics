import { writeFile } from 'node:fs/promises';
export function fleetConfig(env) {
  const config = { enabled: false, commandsEnabled: false, container: 'iCloud.orbitusrobotics.ViperFleet', environment: 'production', apiToken: '' };
  if (env.VIPER_FLEET_ENABLED !== 'true') return config;
  const { VIPER_FLEET_CONTAINER: container, VIPER_FLEET_ENVIRONMENT: environment, VIPER_FLEET_API_TOKEN: apiToken } = env;
  if (!/^iCloud\.[A-Za-z0-9.-]+$/.test(container || '') || !['production', 'development'].includes(environment) || typeof apiToken !== 'string' || !apiToken.trim()) throw new Error('Viper Fleet cloud configuration is incomplete');
  return { enabled: true, commandsEnabled: env.VIPER_FLEET_COMMANDS_ENABLED === 'true', container, environment, apiToken };
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  const config = fleetConfig(process.env);
  await writeFile('public/viper-fleet/config.json', JSON.stringify(config, null, 2) + '\n');
  console.log(`Viper Fleet: ${config.enabled ? 'cloud connection configured; live permission testing still required' : 'inactive staging preview'}`);
}
