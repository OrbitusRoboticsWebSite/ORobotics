import QRCode from 'qrcode';
import {
  ROB_SCHOOL_TOTAL,
  ROB_SCHOOL_VERSION,
  cleanMakerName,
  decodeProgress,
  encodeProgress,
  mergeCompleted,
  normalizeCompleted,
  rewardCodeFromHex,
} from './robot-lab-passport-core.mjs';

const root = document.querySelector('[data-maker-passport]');

if (root) {
  const recordType = 'ROBLeaderboardEntry';
  const progressRecordName = 'rob-school-progress-v1';
  const progressStorageKey = 'rob-circuit-quest-progress';
  const deviceStorageKey = 'rob-school-device-v1';
  const profileStorageKey = 'rob-school-profile-v1';
  const configElement = document.getElementById('rob-school-cloudkit-config');
  const elements = {
    count: root.querySelector('[data-passport-count]'),
    bar: root.querySelector('[data-passport-bar]'),
    device: root.querySelector('[data-passport-device]'),
    form: root.querySelector('[data-passport-form]'),
    nickname: root.querySelector('[data-passport-nickname]'),
    profileStatus: root.querySelector('[data-passport-profile-status]'),
    auth: root.querySelector('[data-passport-auth]'),
    cloudStatus: root.querySelector('[data-passport-cloud-status]'),
    sync: root.querySelector('[data-passport-sync]'),
    issue: root.querySelector('[data-passport-issue]'),
    reward: root.querySelector('[data-passport-reward]'),
    rewardStatus: root.querySelector('[data-passport-reward-status]'),
    rewardCode: root.querySelector('[data-passport-reward-code]'),
    qr: root.querySelector('[data-passport-qr]'),
    verify: root.querySelector('[data-passport-verify]'),
  };
  const config = readConfig();
  const cloudConfigured = Boolean(config?.apiToken && config?.container);
  let completed = readLocalProgress();
  let cloudContainer;
  let privateDatabase;
  let publicDatabase;
  let cloudIdentity;
  let privateRecord;
  let saveTimer;

  const deviceId = readOrCreateDeviceId();
  elements.device.textContent = deviceId;
  elements.nickname.value = readProfile();
  renderProgress();

  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nickname = cleanMakerName(elements.nickname.value);
    elements.nickname.value = nickname;
    try { localStorage.setItem(profileStorageKey, nickname); } catch { /* Device storage is optional. */ }
    elements.profileStatus.textContent = 'Maker name saved on this device.';
    if (cloudIdentity) await savePrivateProgress('Maker name and progress synced privately to iCloud.');
  });

  elements.sync.addEventListener('click', async () => {
    if (!cloudIdentity) {
      elements.cloudStatus.textContent = cloudConfigured ? 'Sign in with Apple first, then sync.' : 'CloudKit is not enabled in this build; device progress is still available.';
      return;
    }
    await loadAndMergePrivateProgress(true);
  });

  elements.issue.addEventListener('click', async () => {
    if (completed.length !== ROB_SCHOOL_TOTAL) {
      elements.rewardStatus.textContent = `Finish ${ROB_SCHOOL_TOTAL - completed.length} more ${ROB_SCHOOL_TOTAL - completed.length === 1 ? 'build' : 'builds'} to unlock the pass.`;
      return;
    }
    if (!cloudIdentity) {
      elements.rewardStatus.textContent = cloudConfigured ? 'Sign in with Apple to bind one reward claim to this account.' : 'CloudKit rewards are not enabled in this build.';
      return;
    }
    await issueReward();
  });

  window.addEventListener('rob:curriculum-progress', (event) => {
    completed = normalizeCompleted(event.detail?.completed);
    renderProgress();
    schedulePrivateSave();
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== progressStorageKey) return;
    completed = readLocalProgress();
    renderProgress();
  });

  if (cloudConfigured) setUpCloudKitAuthentication();
  else {
    elements.auth.hidden = true;
    elements.cloudStatus.textContent = 'Device passport active. CloudKit sign-in is not enabled in this build.';
    verifyRewardFromUrl();
  }

  function readConfig() {
    if (!configElement) return undefined;
    try { return JSON.parse(configElement.textContent || '{}'); } catch { return undefined; }
  }

  function readLocalProgress() {
    try { return normalizeCompleted(JSON.parse(localStorage.getItem(progressStorageKey) || '[]')); } catch { return []; }
  }

  function readProfile() {
    try { return cleanMakerName(localStorage.getItem(profileStorageKey) || 'ROB MAKER'); } catch { return 'ROB MAKER'; }
  }

  function readOrCreateDeviceId() {
    try {
      const saved = String(localStorage.getItem(deviceStorageKey) || '');
      if (/^ROB-[A-F0-9]{4}-[A-F0-9]{4}$/.test(saved)) return saved;
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
      const id = `ROB-${hex.slice(0, 4)}-${hex.slice(4)}`;
      localStorage.setItem(deviceStorageKey, id);
      return id;
    } catch { return 'ROB-LOCAL-ONLY'; }
  }

  function renderProgress() {
    const count = completed.length;
    elements.count.textContent = `${count} / ${ROB_SCHOOL_TOTAL}`;
    elements.bar.style.width = `${count / ROB_SCHOOL_TOTAL * 100}%`;
    elements.issue.disabled = count !== ROB_SCHOOL_TOTAL || !cloudIdentity;
    root.classList.toggle('is-graduated', count === ROB_SCHOOL_TOTAL);
    if (count < ROB_SCHOOL_TOTAL) {
      elements.reward.hidden = true;
      elements.rewardStatus.textContent = `${ROB_SCHOOL_TOTAL - count} builds remain. Your local passport updates after every completed mission.`;
    } else if (!cloudIdentity) {
      elements.rewardStatus.textContent = 'Curriculum complete! Sign in with Apple to create one recallable Maker Faire pass.';
    } else {
      elements.rewardStatus.textContent = 'Curriculum complete and account ready. Issue or recall your Maker Faire pass.';
    }
  }

  function setUpCloudKitAuthentication() {
    if (!window.CloudKit) {
      const script = document.getElementById('rob-school-cloudkit-script');
      if (script && !script.dataset.robSchoolListeners) {
        script.dataset.robSchoolListeners = 'true';
        script.addEventListener('load', setUpCloudKitAuthentication, { once: true });
        script.addEventListener('error', showAuthError, { once: true });
        elements.cloudStatus.textContent = 'Loading Apple sign-in…';
      } else if (!script) showAuthError();
      return;
    }
    try {
      window.CloudKit.configure({
        containers: [{
          containerIdentifier: config.container,
          environment: config.environment === 'development' ? window.CloudKit.DEVELOPMENT_ENVIRONMENT : window.CloudKit.PRODUCTION_ENVIRONMENT,
          apiTokenAuth: {
            apiToken: config.apiToken,
            persist: true,
            signInButton: { id: 'rob-school-apple-sign-in' },
            signOutButton: { id: 'rob-school-apple-sign-out' },
          },
        }],
      });
      cloudContainer = window.CloudKit.getDefaultContainer();
      privateDatabase = cloudContainer.privateCloudDatabase;
      publicDatabase = cloudContainer.publicCloudDatabase;
      cloudContainer.whenUserSignsIn().then(setIdentity).catch(showAuthError);
      cloudContainer.whenUserSignsOut().then(() => setIdentity()).catch(showAuthError);
      cloudContainer.setUpAuth().then(setIdentity).catch(showAuthError);
      verifyRewardFromUrl();
    } catch { showAuthError(); }
  }

  async function setIdentity(identity) {
    cloudIdentity = identity || undefined;
    privateRecord = undefined;
    elements.auth.hidden = false;
    if (!userRecordName()) {
      elements.cloudStatus.textContent = 'Device passport ready. Sign in with Apple to merge private progress across browsers.';
      renderProgress();
      return;
    }
    elements.cloudStatus.textContent = 'Signed in. Loading your private learner passport…';
    renderProgress();
    await loadAndMergePrivateProgress(false);
  }

  function userRecordName() {
    return cloudIdentity?.userRecordName || cloudIdentity?.userIdentity?.userRecordName;
  }

  function showAuthError() {
    cloudIdentity = undefined;
    privateDatabase = undefined;
    elements.cloudStatus.textContent = 'Apple sign-in is temporarily unavailable. Progress remains safe on this device.';
    renderProgress();
  }

  async function loadAndMergePrivateProgress(announce) {
    try {
      const response = await privateDatabase.fetchRecords(progressRecordName, {
        desiredKeys: ['callSign', 'score', 'levelsCompleted', 'completedAt', 'platform', 'gameVersion', 'websiteVisible'],
      });
      privateRecord = response?.records?.[0];
    } catch {
      privateRecord = undefined;
    }
    const cloudCompleted = decodeProgress(fieldValue(privateRecord, 'gameVersion'));
    const merged = mergeCompleted(completed, cloudCompleted);
    const added = merged.length - completed.length;
    completed = merged;
    try { localStorage.setItem(progressStorageKey, JSON.stringify(completed)); } catch { /* Cloud remains available. */ }
    window.dispatchEvent(new CustomEvent('rob:merge-progress', { detail: { completed } }));
    const cloudName = fieldValue(privateRecord, 'callSign');
    if (cloudName) {
      elements.nickname.value = cleanMakerName(cloudName);
      try { localStorage.setItem(profileStorageKey, elements.nickname.value); } catch { /* Optional. */ }
    }
    renderProgress();
    await savePrivateProgress(announce
      ? `Private sync complete${added ? ` · ${added} build${added === 1 ? '' : 's'} recalled` : ' · already current'}.`
      : 'Private learner passport is current.');
  }

  function schedulePrivateSave() {
    if (!cloudIdentity) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => savePrivateProgress(), 450);
  }

  async function savePrivateProgress(successMessage) {
    if (!privateDatabase || !userRecordName()) return;
    elements.sync.disabled = true;
    elements.cloudStatus.textContent = 'Saving private progress to iCloud…';
    const record = {
      recordType,
      recordName: progressRecordName,
      fields: {
        callSign: { value: cleanMakerName(elements.nickname.value) },
        score: { value: completed.length * 3 },
        durationSeconds: { value: 0 },
        levelsCompleted: { value: completed.length },
        completedAt: { value: new Date() },
        platform: { value: 'robot-lab-private' },
        gameVersion: { value: encodeProgress(completed) },
        websiteVisible: { value: 0 },
      },
    };
    if (privateRecord?.recordChangeTag) record.recordChangeTag = privateRecord.recordChangeTag;
    try {
      const response = await privateDatabase.saveRecords(record, {
        desiredKeys: ['callSign', 'score', 'levelsCompleted', 'completedAt', 'platform', 'gameVersion', 'websiteVisible'],
      });
      if (response?.errors?.length || !response?.records?.length) throw new Error('CloudKit save failed');
      privateRecord = response.records[0];
      elements.cloudStatus.textContent = successMessage || 'Progress synced privately to iCloud.';
    } catch {
      elements.cloudStatus.textContent = 'Cloud sync did not finish. Device progress is safe; try again when the connection is ready.';
    } finally {
      elements.sync.disabled = false;
    }
  }

  async function issueReward() {
    elements.issue.disabled = true;
    elements.rewardStatus.textContent = 'Creating your minimal CloudKit reward claim…';
    try {
      await savePrivateProgress();
      const digest = await sha256(`${config.container}:${userRecordName()}:${ROB_SCHOOL_VERSION}`);
      const recordName = `rob-school-reward-${digest.slice(0, 32)}`;
      const code = rewardCodeFromHex(digest);
      let existing = await fetchRecord(publicDatabase, recordName);
      if (!existing) {
        const response = await publicDatabase.saveRecords({
          recordType,
          recordName,
          fields: {
            callSign: { value: 'ROB MAKER' },
            score: { value: 0 },
            durationSeconds: { value: 0 },
            levelsCompleted: { value: ROB_SCHOOL_TOTAL },
            completedAt: { value: new Date() },
            platform: { value: 'robot-lab-reward' },
            gameVersion: { value: `${ROB_SCHOOL_VERSION}:${code}` },
            websiteVisible: { value: 0 },
          },
        }, { desiredKeys: ['levelsCompleted', 'platform', 'gameVersion', 'completedAt'] });
        if (response?.errors?.length || !response?.records?.length) throw new Error('Reward claim save failed');
        existing = response.records[0];
      }
      await showReward(recordName, code, existing);
    } catch {
      elements.rewardStatus.textContent = 'The pass could not be issued yet. Your 80-build completion is still saved; retry when CloudKit is available.';
      elements.issue.disabled = false;
    }
  }

  async function showReward(recordName, code, record) {
    if (!validRewardRecord(record, code)) throw new Error('Reward claim mismatch');
    const url = new URL('/robot-lab/', window.location.origin);
    url.searchParams.set('reward', recordName);
    url.searchParams.set('code', code);
    url.hash = 'maker-reward';
    await QRCode.toCanvas(elements.qr, url.toString(), { width: 260, margin: 2, color: { dark: '#101126', light: '#ffffff' }, errorCorrectionLevel: 'M' });
    elements.rewardCode.textContent = code;
    elements.reward.hidden = false;
    elements.rewardStatus.textContent = 'Pass ready. Booth staff scans it and checks the matching CloudKit claim.';
    elements.reward.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function verifyRewardFromUrl() {
    const query = new URLSearchParams(window.location.search);
    const recordName = query.get('reward') || '';
    const code = query.get('code') || '';
    if (!recordName || !code || !elements.verify) return;
    elements.verify.hidden = false;
    elements.verify.dataset.state = 'loading';
    elements.verify.textContent = 'Checking this reward claim with CloudKit…';
    if (!publicDatabase) {
      elements.verify.dataset.state = 'unavailable';
      elements.verify.textContent = 'CloudKit verification is unavailable in this build. Booth staff should not redeem this pass yet.';
      return;
    }
    const record = await fetchRecord(publicDatabase, recordName);
    const valid = validRewardRecord(record, code);
    elements.verify.dataset.state = valid ? 'valid' : 'invalid';
    elements.verify.textContent = valid
      ? `VALID ROB SCHOOL PASS · ${code} · 80/80 builds. Staff: check the booth’s one-time redemption log before awarding the prize.`
      : 'INVALID OR UNAVAILABLE PASS · Do not redeem. Ask the maker to reopen their signed-in learner passport.';
  }

  function validRewardRecord(record, code) {
    return Boolean(record
      && fieldValue(record, 'levelsCompleted') === ROB_SCHOOL_TOTAL
      && fieldValue(record, 'platform') === 'robot-lab-reward'
      && fieldValue(record, 'gameVersion') === `${ROB_SCHOOL_VERSION}:${code}`);
  }

  async function fetchRecord(database, recordName) {
    if (!database || !/^rob-school-reward-[a-f0-9]{32}$/i.test(recordName)) return undefined;
    try {
      const response = await database.fetchRecords(recordName, { desiredKeys: ['levelsCompleted', 'platform', 'gameVersion', 'completedAt'] });
      return response?.records?.[0];
    } catch { return undefined; }
  }

  function fieldValue(record, name) {
    return record?.fields?.[name]?.value;
  }

  async function sha256(value) {
    if (!crypto?.subtle || !window.TextEncoder) throw new Error('Secure hashing is unavailable');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
}
