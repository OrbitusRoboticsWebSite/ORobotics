(() => {
  "use strict";

  const root = document.querySelector("[data-rob-simulator]");
  const form = document.querySelector("[data-score-form]");
  const nameInput = document.querySelector("[data-score-name]");
  const submitButton = document.querySelector("[data-score-submit]");
  const scoreboard = document.querySelector("[data-scoreboard]");
  const sourceLabel = document.querySelector("[data-score-source]");
  const cloudStatus = document.querySelector("[data-score-status]");
  const authStatus = document.querySelector("[data-score-auth-status]");
  const authControls = document.querySelector("[data-score-auth]");
  const clearButton = document.querySelector("[data-clear-scores]");
  const configElement = document.getElementById("rob-cloudkit-config");

  if (!root || !form || !nameInput || !submitButton || !scoreboard || !sourceLabel || !cloudStatus || !authStatus || !authControls || !clearButton) return;

  const storageKey = "rob-tank-training-leaderboard-v1";
  const recordType = "ROBLeaderboardEntry";
  const gameVersion = "1";
  let pendingScore;
  let publicScores = [];
  let publicScoresLoaded = false;
  let cloudContainer;
  let cloudDatabase;
  let cloudIdentity;
  let pendingSavedLocally = false;

  const config = readConfig();
  const cloudConfigured = Boolean(config?.apiToken && config?.container);

  root.addEventListener("rob:campaign-complete", (event) => {
    const score = Math.max(0, Math.round(Number(event.detail?.score) || 0));
    const durationSeconds = Math.max(0, Math.round(Number(event.detail?.durationSeconds) || 0));
    const levelsCompleted = Math.max(0, Math.round(Number(event.detail?.levelsCompleted) || 0));
    pendingScore = { score, durationSeconds, levelsCompleted, completedAt: new Date().toISOString() };
    pendingSavedLocally = false;
    form.hidden = false;
    updateSubmitButton();
    nameInput.focus({ preventScroll: true });
  });

  root.addEventListener("rob:campaign-reset", () => {
    pendingScore = undefined;
    pendingSavedLocally = false;
    form.hidden = true;
    submitButton.disabled = false;
    submitButton.textContent = cloudConfigured ? "Publish score" : "Save score";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!pendingScore) return;

    const entry = {
      ...pendingScore,
      name: cleanCallSign(nameInput.value),
    };
    if (!pendingSavedLocally) {
      saveLocalScore(entry);
      pendingSavedLocally = true;
    }

    if (!cloudConfigured) {
      pendingScore = undefined;
      pendingSavedLocally = false;
      form.hidden = true;
      nameInput.value = "";
      renderScores(readLocalScores(), false);
      cloudStatus.textContent = "Score saved on this device. CloudKit publishing is not configured for this build.";
      return;
    }

    if (!cloudDatabase || !cloudIdentity?.userRecordName) {
      renderFallbackIfNeeded();
      authStatus.textContent = "Your score is safe on this device. Sign in with Apple to publish it to CloudKit.";
      updateSubmitButton();
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Publishing…";
    authStatus.textContent = "Publishing your completed campaign to CloudKit…";

    try {
      const result = await publishBestScore(entry);
      pendingScore = undefined;
      pendingSavedLocally = false;
      form.hidden = true;
      nameInput.value = "";
      if (result.visible) {
        mergePublishedScore(result.entry);
        renderScores(publicScores, true);
      } else if (publicScoresLoaded) {
        publicScores = publicScores.filter((candidate) => candidate.recordName !== result.entry.recordName);
        renderScores(publicScores, true);
      }
      authStatus.textContent = !result.visible
        ? "Saved to CloudKit. This score is not currently listed on the public board."
        : result.updated
          ? "Published. This Apple account’s best ROB score is now public."
          : "Saved locally. Your existing public ROB score is still your best.";
      if (publicScoresLoaded) cloudStatus.textContent = `${publicScores.length} public ${publicScores.length === 1 ? "pilot" : "pilots"}, ranked by score.`;
      submitButton.textContent = "Publish score";
    } catch {
      renderFallbackIfNeeded();
      submitButton.disabled = false;
      submitButton.textContent = "Retry publish";
      authStatus.textContent = "The score is saved on this device, but CloudKit could not publish it. You can retry.";
    }
  });

  clearButton.addEventListener("click", () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Storage can be disabled without affecting the public leaderboard.
    }
    if (!publicScoresLoaded) renderScores([], false);
    cloudStatus.textContent = publicScoresLoaded
      ? "Scores stored only on this device were cleared. Public CloudKit scores remain."
      : "Scores stored on this device were cleared.";
  });

  renderScores(readLocalScores(), false);
  if (cloudConfigured) {
    sourceLabel.textContent = "Public CloudKit rankings";
    cloudStatus.textContent = "Loading the public ROB leaderboard…";
    authControls.hidden = false;
    loadPublicScores();
    setUpCloudKitAuthentication();
  } else {
    sourceLabel.textContent = "Stored on this device";
    cloudStatus.textContent = "Complete all fifteen levels to save a score on this device.";
    authStatus.textContent = "CloudKit publishing is unavailable in this build.";
  }

  function readConfig() {
    if (!configElement) return undefined;
    try {
      return JSON.parse(configElement.textContent || "{}");
    } catch {
      return undefined;
    }
  }

  function readLocalScores() {
    try {
      const entries = JSON.parse(localStorage.getItem(storageKey) || "[]");
      return Array.isArray(entries) ? entries.map(normalizeEntry).filter(Boolean).sort(compareScores).slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  function saveLocalScore(entry) {
    const entries = [...readLocalScores(), normalizeEntry(entry)].filter(Boolean).sort(compareScores).slice(0, 10);
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // CloudKit publishing can still succeed when local storage is disabled.
    }
  }

  function normalizeEntry(entry) {
    const score = Math.max(0, Math.round(Number(entry?.score) || 0));
    const durationSeconds = Math.max(0, Math.round(Number(entry?.durationSeconds) || parseTime(entry?.time)));
    const name = cleanCallSign(entry?.name || entry?.callSign);
    if (!name) return undefined;
    return {
      name,
      score,
      durationSeconds,
      levelsCompleted: Math.max(0, Math.round(Number(entry?.levelsCompleted) || 10)),
      completedAt: String(entry?.completedAt || ""),
      recordName: String(entry?.recordName || ""),
    };
  }

  function compareScores(left, right) {
    return right.score - left.score || left.durationSeconds - right.durationSeconds || left.name.localeCompare(right.name);
  }

  function cleanCallSign(value) {
    const cleaned = String(value || "")
      .toUpperCase()
      .replace(/[^A-Z0-9 _-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12);
    return cleaned || "ROB PILOT";
  }

  function parseTime(value) {
    const parts = String(value || "").split(":").map(Number);
    if (parts.length !== 2 || parts.some((part) => !Number.isFinite(part))) return 0;
    return Math.max(0, Math.round(parts[0] * 60 + parts[1]));
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(value / 60);
    return `${String(minutes).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function renderScores(entries, isPublic) {
    const normalized = entries.map(normalizeEntry).filter(Boolean).sort(compareScores).slice(0, 20);
    const fragment = document.createDocumentFragment();

    if (normalized.length === 0) {
      const empty = document.createElement("li");
      empty.className = "rob-sim__scoreboard-empty";
      empty.textContent = isPublic ? "No public missions yet. Be the first pilot on the board." : "No completed missions saved on this device yet.";
      fragment.append(empty);
    } else {
      normalized.forEach((entry, index) => {
        const row = document.createElement("li");
        const name = document.createElement("span");
        const score = document.createElement("strong");
        const duration = document.createElement("small");
        name.textContent = `${index + 1}. ${entry.name}`;
        score.textContent = entry.score.toLocaleString();
        duration.textContent = formatDuration(entry.durationSeconds);
        row.append(name, score, duration);
        fragment.append(row);
      });
    }

    scoreboard.replaceChildren(fragment);
    scoreboard.dataset.source = isPublic ? "cloudkit" : "local";
  }

  function renderFallbackIfNeeded() {
    if (!publicScoresLoaded) renderScores(readLocalScores(), false);
  }

  async function loadPublicScores() {
    const environment = config.environment === "development" ? "development" : "production";
    const endpoint = new URL(
      `https://api.apple-cloudkit.com/database/1/${encodeURIComponent(config.container)}/${environment}/public/records/query`
    );
    endpoint.searchParams.set("ckAPIToken", config.apiToken);

    const request = {
      resultsLimit: 50,
      desiredKeys: ["callSign", "score", "durationSeconds", "levelsCompleted", "completedAt", "platform", "gameVersion", "websiteVisible"],
      query: {
        recordType,
        filterBy: [],
        sortBy: [
          { fieldName: "score", ascending: false },
          { fieldName: "durationSeconds", ascending: true },
          { fieldName: "completedAt", ascending: true },
        ],
      },
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error("CloudKit request failed");
      const payload = await response.json();
      if (payload.serverErrorCode) throw new Error("CloudKit returned an error");

      publicScores = (Array.isArray(payload.records) ? payload.records : [])
        .filter((record) => !record.serverErrorCode && isVisible(record))
        .map((record) => normalizeEntry({
          name: fieldValue(record, "callSign"),
          score: fieldValue(record, "score"),
          durationSeconds: fieldValue(record, "durationSeconds"),
          levelsCompleted: fieldValue(record, "levelsCompleted"),
          completedAt: fieldValue(record, "completedAt"),
          recordName: record.recordName,
        }))
        .filter(Boolean)
        .sort(compareScores)
        .slice(0, 20);
      publicScoresLoaded = true;
      renderScores(publicScores, true);
      cloudStatus.textContent = publicScores.length
        ? `${publicScores.length} public ${publicScores.length === 1 ? "pilot" : "pilots"}, ranked by score.`
        : "The CloudKit leaderboard is ready for its first completed campaign.";
    } catch {
      publicScoresLoaded = false;
      renderScores(readLocalScores(), false);
      cloudStatus.textContent = "The public leaderboard is temporarily unavailable. Showing scores saved on this device.";
    }
  }

  function fieldValue(record, name) {
    return record?.fields?.[name]?.value;
  }

  function isVisible(record) {
    const value = fieldValue(record, "websiteVisible");
    return value == null || value === true || value === 1 || value === "1" || value === "true";
  }

  function setUpCloudKitAuthentication() {
    if (!window.CloudKit) {
      const script = document.getElementById("rob-cloudkit-script");
      if (script && !script.dataset.robAuthListeners) {
        script.dataset.robAuthListeners = "true";
        script.addEventListener("load", setUpCloudKitAuthentication, { once: true });
        script.addEventListener("error", showAuthError, { once: true });
        authStatus.textContent = "Loading Apple sign-in…";
      } else if (!script) {
        showAuthError();
      }
      updateSubmitButton();
      return;
    }

    try {
      window.CloudKit.configure({
        containers: [{
          containerIdentifier: config.container,
          environment: config.environment === "development"
            ? window.CloudKit.DEVELOPMENT_ENVIRONMENT
            : window.CloudKit.PRODUCTION_ENVIRONMENT,
          apiTokenAuth: {
            apiToken: config.apiToken,
            persist: true,
            signInButton: { id: "rob-apple-sign-in" },
            signOutButton: { id: "rob-apple-sign-out" },
          },
        }],
      });
      cloudContainer = window.CloudKit.getDefaultContainer();
      cloudDatabase = cloudContainer.publicCloudDatabase;
      cloudContainer.whenUserSignsIn().then(setIdentity).catch(showAuthError);
      cloudContainer.whenUserSignsOut().then(() => setIdentity(undefined)).catch(showAuthError);
      cloudContainer.setUpAuth().then(setIdentity).catch(showAuthError);
    } catch {
      showAuthError();
    }
  }

  function setIdentity(identity) {
    cloudIdentity = identity || undefined;
    authStatus.textContent = cloudIdentity
      ? "Signed in to iCloud. Completed campaigns can publish one best score for this Apple account."
      : "Sign in with Apple to publish a completed campaign. Public scores are visible without signing in.";
    updateSubmitButton();
  }

  function showAuthError() {
    cloudIdentity = undefined;
    authStatus.textContent = "Apple sign-in is temporarily unavailable. Scores can still be saved on this device.";
    updateSubmitButton();
  }

  function updateSubmitButton() {
    if (!cloudConfigured) {
      submitButton.disabled = false;
      submitButton.textContent = "Save score";
      return;
    }
    submitButton.disabled = !cloudIdentity && pendingSavedLocally;
    submitButton.textContent = cloudIdentity ? "Publish score" : pendingSavedLocally ? "Sign in to publish" : "Save locally";
  }

  async function publishBestScore(entry) {
    const recordName = await recordNameForUser(cloudIdentity.userRecordName);
    const existing = await fetchExistingRecord(recordName);
    const existingEntry = existing && normalizeEntry({
      name: fieldValue(existing, "callSign"),
      score: fieldValue(existing, "score"),
      durationSeconds: fieldValue(existing, "durationSeconds"),
      levelsCompleted: fieldValue(existing, "levelsCompleted"),
      completedAt: fieldValue(existing, "completedAt"),
      recordName,
    });

    if (existingEntry && compareScores(existingEntry, entry) <= 0) {
      return { entry: existingEntry, updated: false, visible: isVisible(existing) };
    }

    const record = {
      recordType,
      recordName,
      fields: {
        callSign: { value: entry.name },
        score: { value: entry.score },
        durationSeconds: { value: entry.durationSeconds },
        levelsCompleted: { value: entry.levelsCompleted },
        completedAt: { value: new Date(entry.completedAt) },
        platform: { value: "web" },
        gameVersion: { value: gameVersion },
      },
    };
    if (existing?.recordChangeTag) record.recordChangeTag = existing.recordChangeTag;

    const response = await cloudDatabase.saveRecords(record, {
      desiredKeys: ["callSign", "score", "durationSeconds", "levelsCompleted", "completedAt", "websiteVisible"],
    });
    if (response?.errors?.length || !response?.records?.length) throw new Error("CloudKit save failed");

    return {
      entry: normalizeEntry({ ...entry, recordName }),
      updated: true,
      visible: isVisible(response.records[0]),
    };
  }

  async function fetchExistingRecord(recordName) {
    try {
      const response = await cloudDatabase.fetchRecords(recordName, {
        desiredKeys: ["callSign", "score", "durationSeconds", "levelsCompleted", "completedAt", "websiteVisible"],
      });
      return response?.records?.[0];
    } catch {
      return undefined;
    }
  }

  async function recordNameForUser(userRecordName) {
    const value = `${config.container}:${userRecordName}`;
    if (window.crypto?.subtle && window.TextEncoder) {
      const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
      const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
      return `rob-web-${hex.slice(0, 32)}`;
    }
    return `rob-web-${String(userRecordName).replace(/[^A-Za-z0-9_-]/g, "").slice(-40)}`;
  }

  function mergePublishedScore(entry) {
    publicScoresLoaded = true;
    publicScores = [entry, ...publicScores.filter((candidate) => candidate.recordName !== entry.recordName)]
      .map(normalizeEntry)
      .filter(Boolean)
      .sort(compareScores)
      .slice(0, 20);
  }
})();
