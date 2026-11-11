import { detectPlatform } from '../r/portal.mjs';

export function mountViperLink(doc, nav) {
  const components = [...doc.querySelectorAll('[data-component]')];
  const panels = [...doc.querySelectorAll('[data-component-panel]')];
  const platforms = [...doc.querySelectorAll('[data-os]')];
  const commands = [...doc.querySelectorAll('[data-os-panel]')];
  const all = doc.getElementById('vl-all');
  function chooseComponent(component) {
    for (const button of components) button.setAttribute('aria-pressed', String(button.dataset.component === component));
    for (const panel of panels) panel.hidden = component !== null && panel.dataset.componentPanel !== component;
    all.setAttribute('aria-pressed', String(component === null));
  }
  function choosePlatform(platform) {
    for (const button of platforms) button.setAttribute('aria-pressed', String(button.dataset.os === platform));
    for (const command of commands) command.hidden = platform !== 'all' && command.dataset.osPanel !== platform;
  }
  for (const button of components) button.addEventListener('click', () => chooseComponent(button.dataset.component));
  for (const button of platforms) button.addEventListener('click', () => choosePlatform(button.dataset.os));
  all.addEventListener('click', () => chooseComponent(null));
  chooseComponent('cloud');
  const detected = detectPlatform(nav);
  choosePlatform(detected || 'all');
  const labels = { macos: 'macOS', windows: 'Windows', linux: 'Linux' };
  doc.getElementById('vl-detection').textContent = detected ? `${labels[detected]} detected. You can choose another platform.` : 'Choose a desktop platform. All commands are shown.';
  for (const button of doc.querySelectorAll('[data-copy]')) {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const status = doc.getElementById('vl-copy-status');
      try {
        await nav.clipboard.writeText(doc.getElementById(button.dataset.copy).textContent);
        status.textContent = 'Install command copied. Paste it into your terminal when ready.';
      } catch { status.textContent = 'Clipboard unavailable. Select and copy the complete command above.'; }
    });
  }
}
if (typeof document !== 'undefined') mountViperLink(document, navigator);
