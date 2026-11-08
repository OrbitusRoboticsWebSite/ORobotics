// Recommendation only. Installers independently detect OS and native architecture.
export function detectPlatform({ userAgent = '', platform = '', userAgentData, maxTouchPoints = 0 } = {}) {
  const hint = userAgentData?.platform || platform;
  if (/Android|iPhone|iPad|iPod|CrOS/i.test(userAgent) || (/Mac/i.test(hint) && maxTouchPoints > 1)) return null;
  if (/Windows|Win32|Win64/i.test(hint) || /Windows NT/i.test(userAgent)) return 'windows';
  if (/macOS|MacIntel|MacPPC|Macintosh/i.test(hint) || /Macintosh/i.test(userAgent)) return 'macos';
  if (/Linux/i.test(hint) || /Linux/i.test(userAgent)) return 'linux';
  return null;
}

export function mountPortal(doc, nav) {
  const buttons = [...doc.querySelectorAll('[data-platform]')];
  const panels = [...doc.querySelectorAll('[data-panel]')];
  const showAll = doc.getElementById('ra-show-all');
  const detection = doc.getElementById('ra-detection');
  function choose(platform) {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.platform === platform));
    showAll.setAttribute('aria-pressed', String(platform === null));
    for (const panel of panels) panel.hidden = platform !== null && panel.dataset.panel !== platform;
  }
  for (const button of buttons) button.addEventListener('click', () => choose(button.dataset.platform));
  showAll.addEventListener('click', () => choose(null));
  const platform = detectPlatform(nav);
  const labels = { windows: 'Windows', macos: 'macOS', linux: 'Linux' };
  detection.textContent = platform ? `${labels[platform]} detected. You can choose another platform.` : 'Choose a desktop platform. All commands are shown.';
  choose(platform);
  for (const button of doc.querySelectorAll('[data-copy]')) {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const text = doc.getElementById(button.dataset.copy).textContent;
      const status = doc.getElementById('ra-copy-status');
      try {
        await nav.clipboard.writeText(text);
        status.textContent = 'Command copied. Paste it into your terminal when ready.';
      } catch {
        status.textContent = 'Clipboard unavailable. Select and copy the complete command above.';
      }
    });
  }
}
if (typeof document !== 'undefined') mountPortal(document, navigator);
