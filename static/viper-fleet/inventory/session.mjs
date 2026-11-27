import { validInventoryGroup, queryFleet } from '../core.mjs';

export const inventoryContainer = 'iCloud.orbitusrobotics.RedAgentInventory';

export function inventoryWebConfig(environment, token) {
  if (!['development', 'production'].includes(environment) || typeof token !== 'string'
      || !token || /\s|-----BEGIN/.test(token)) throw new Error('Invalid inventory web configuration');
  return { enabled: true, container: inventoryContainer, environment, apiToken: token };
}

export function openInventoryContainer(apple, config) {
  if (config.enabled !== true || config.container !== inventoryContainer) throw new Error('Unexpected inventory container');
  inventoryWebConfig(config.environment, config.apiToken);
  apple.configure({ containers: [{
    containerIdentifier: inventoryContainer,
    environment: config.environment,
    apiTokenAuth: { apiToken: config.apiToken, persist: false,
      signInButton: { id: 'inventory-sign-in' }, signOutButton: { id: 'inventory-sign-out' } },
  }] });
  const container = apple.getContainer(inventoryContainer);
  if (container?.containerIdentifier !== inventoryContainer || container.environment !== config.environment) {
    throw new Error('Inventory connection unavailable');
  }
  return container;
}

export class InventoryView {
  constructor(database, render) {
    this.database = database;
    this.render = render;
    this.generation = 0;
    this.signedIn = false;
  }
  setIdentity(identity) {
    this.signedIn = Boolean(identity?.userRecordName || identity?.userIdentity?.userRecordName);
    this.clear(this.signedIn ? 'Enter the group code supplied by your administrator.' : 'Sign in with an authorized Apple account.');
  }
  clear(message = '') {
    this.generation++;
    this.render(message, []);
  }
  async load(group) {
    if (!this.signedIn) return;
    if (!validInventoryGroup(group)) {
      this.clear('Enter a lowercase group code of up to 24 letters and digits beginning with a letter.');
      return;
    }
    this.clear('Loading Mac reports…');
    const generation = this.generation;
    const current = () => this.signedIn && this.generation === generation;
    try {
      const reports = await queryFleet(this.database, current, group);
      if (current()) this.render(reports.length ? `${reports.length} Mac report${reports.length === 1 ? '' : 's'}` : 'No reports for this group.', reports);
    } catch {
      if (current()) this.clear('Reports unavailable. Check your group code and account access, then retry.');
    }
  }
}
