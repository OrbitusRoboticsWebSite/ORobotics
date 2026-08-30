import {
  decodeDroidProfile,
  droidFinishes,
  droidHousingMaterials,
  droidHousingStyles,
  droidSectionDefinitions,
  droidSectionProgress,
  encodeDroidProfile,
  profileWithCurriculum,
  readDroidProfile,
  sanitizeDroidProfile,
  writeDroidProfile,
} from './rob-droid-profile.mjs';

const builders = [...document.querySelectorAll('[data-droid-builder]')];

builders.forEach((root) => {
  const elements = {
    name: root.querySelector('[data-droid-name]'),
    finish: root.querySelector('[data-droid-finish]'),
    material: root.querySelector('[data-droid-material]'),
    housing: root.querySelector('[data-droid-housing]'),
    code: root.querySelector('[data-droid-code]'),
    status: root.querySelector('[data-droid-status]'),
    sections: root.querySelector('[data-droid-sections]'),
    preview: root.querySelector('[data-droid-preview]'),
    importButton: root.querySelector('[data-droid-import]'),
    copyButton: root.querySelector('[data-droid-copy]'),
  };
  let completed = readCurriculum();
  let profile = profileWithCurriculum(readDroidProfile(), completed);

  populateSelect(elements.finish, droidFinishes);
  populateSelect(elements.material, droidHousingMaterials);
  populateSelect(elements.housing, droidHousingStyles);
  saveAndRender('Droid profile ready on this device.', false);

  elements.name?.addEventListener('change', () => update({ name: elements.name.value }, 'Droid designation saved.'));
  elements.finish?.addEventListener('change', () => update({ finish: elements.finish.value }, 'Body color equipped everywhere ROB appears.'));
  elements.material?.addEventListener('change', () => update({ material: elements.material.value }, 'Housing material equipped.'));
  elements.housing?.addEventListener('change', () => update({ housing: elements.housing.value }, 'Housing style equipped.'));
  elements.copyButton?.addEventListener('click', async () => {
    const code = encodeDroidProfile(profile);
    elements.code.value = code;
    try {
      await navigator.clipboard.writeText(code);
      setStatus('Droid Code copied. Paste it into ROB Training on iPhone, iPad, Vision Pro, or another browser.');
    } catch {
      elements.code.focus();
      elements.code.select();
      setStatus('Copy the selected Droid Code, then import it on the other device.');
    }
  });
  elements.importButton?.addEventListener('click', () => {
    try {
      const imported = decodeDroidProfile(elements.code.value);
      const localSections = droidSectionProgress(completed).filter(({ assembled }) => assembled).map(({ id }) => id);
      profile = sanitizeDroidProfile({ ...imported, sections: [...new Set([...imported.sections, ...localSections])] });
      saveAndRender(`Imported ${profile.name}. Completed local robot sections were kept.`);
    } catch (error) { setStatus(error.message, true); }
  });
  window.addEventListener('rob:curriculum-progress', (event) => {
    completed = Array.isArray(event.detail?.completed) ? event.detail.completed : [];
    profile = profileWithCurriculum(profile, completed);
    saveAndRender('A completed ROB section was added to your droid profile.');
  });
  window.addEventListener('storage', (event) => {
    if (!['rob-circuit-quest-progress', 'rob-droid-profile-v1'].includes(event.key)) return;
    completed = readCurriculum();
    profile = profileWithCurriculum(readDroidProfile(), completed);
    render();
  });

  function populateSelect(select, options) {
    if (!select) return;
    select.replaceChildren(...options.map((option) => {
      const element = document.createElement('option');
      element.value = option.id;
      element.textContent = option.name;
      return element;
    }));
  }

  function readCurriculum() {
    try {
      const value = JSON.parse(localStorage.getItem('rob-circuit-quest-progress') || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function update(changes, message) {
    profile = sanitizeDroidProfile({ ...profile, ...changes });
    saveAndRender(message);
  }

  function saveAndRender(message, announce = true) {
    profile = writeDroidProfile(profile);
    render();
    setStatus(message);
    window.dispatchEvent(new CustomEvent('rob:droid-profile', { detail: { profile, code: encodeDroidProfile(profile), announce } }));
  }

  function render() {
    if (elements.name) elements.name.value = profile.name;
    if (elements.finish) elements.finish.value = profile.finish;
    if (elements.material) elements.material.value = profile.material;
    if (elements.housing) elements.housing.value = profile.housing;
    if (elements.code) elements.code.value = encodeDroidProfile(profile);
    const finish = droidFinishes.find(({ id }) => id === profile.finish) || droidFinishes[0];
    if (elements.preview) {
      elements.preview.style.setProperty('--droid-color', `#${finish.color.toString(16).padStart(6, '0')}`);
      elements.preview.dataset.material = profile.material;
      elements.preview.dataset.housing = profile.housing;
      droidSectionDefinitions.forEach(({ id }) => elements.preview.classList.toggle(`has-${id}`, profile.sections.includes(id)));
    }
    if (elements.sections) {
      const progress = droidSectionProgress(completed);
      elements.sections.replaceChildren(...progress.map((section) => {
        const article = document.createElement('article');
        article.className = section.assembled ? 'is-assembled' : section.completed ? 'is-building' : '';
        article.innerHTML = `<span aria-hidden="true">${section.icon}</span><div><small>${section.assembled ? 'ASSEMBLED' : `${section.completed} / ${section.required} BUILDS`}</small><strong>${section.name}</strong><p>${section.summary}</p><i style="--section-progress:${section.completed / section.required * 100}%"></i></div>`;
        return article;
      }));
    }
  }

  function setStatus(message, error = false) {
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.classList.toggle('is-error', error);
  }
});
