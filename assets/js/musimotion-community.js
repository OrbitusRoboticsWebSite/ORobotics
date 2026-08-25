(() => {
  const configElement = document.getElementById("musimotion-cloudkit-config");
  const grid = document.querySelector("[data-musimotion-community-grid]");
  const fallback = document.querySelector("[data-musimotion-community-fallback]");
  const status = document.querySelector("[data-musimotion-community-status]");

  if (!configElement || !grid || !fallback || !status) return;

  let config;
  try {
    config = JSON.parse(configElement.textContent || "{}");
  } catch {
    return;
  }

  if (!config.apiToken || !config.container) return;

  const environment = config.environment === "development" ? "development" : "production";
  const endpoint = new URL(
    `https://api.apple-cloudkit.com/database/1/${encodeURIComponent(config.container)}/${environment}/public/records/query`
  );
  endpoint.searchParams.set("ckAPIToken", config.apiToken);

  const desiredKeys = [
    "title",
    "summary",
    "author",
    "duration",
    "sceneCount",
    "modifiedAt",
    "preview",
    "poster",
    "previewWatermarked",
    "shareURL",
    "aiAssisted",
    "websiteVisible",
  ];

  const request = {
    resultsLimit: 60,
    desiredKeys,
    query: {
      recordType: "CommunityExperience",
      filterBy: [],
      sortBy: [{ fieldName: "modifiedAt", ascending: false }],
    },
  };

  status.textContent = "Loading the latest public creations…";

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(request),
  })
    .then((response) => {
      if (!response.ok) throw new Error("CloudKit request failed");
      return response.json();
    })
    .then((response) => {
      if (response.serverErrorCode) throw new Error("CloudKit returned an error");

      const records = (Array.isArray(response.records) ? response.records : [])
        .filter((record) => !record.serverErrorCode && isVisible(record))
        .sort((left, right) => dateValue(right, "modifiedAt") - dateValue(left, "modifiedAt"))
        .slice(0, 9);

      if (records.length === 0) {
        status.textContent = "The public gallery is ready for its first creator-published preview.";
        return;
      }

      const fragment = document.createDocumentFragment();
      records.forEach((record) => fragment.append(createCard(record)));
      grid.replaceChildren(fragment);
      grid.hidden = false;
      fallback.hidden = true;
      status.textContent = `${records.length} latest public ${records.length === 1 ? "creation" : "creations"}.`;
    })
    .catch(() => {
      status.textContent = "The community gallery is temporarily unavailable. Please try again later.";
    });

  function field(record, name) {
    return record?.fields?.[name]?.value;
  }

  function textValue(record, name, fallbackValue = "") {
    const value = field(record, name);
    return value == null ? fallbackValue : String(value).trim().slice(0, 500);
  }

  function numericValue(record, name) {
    const value = Number(field(record, name));
    return Number.isFinite(value) ? value : 0;
  }

  function dateValue(record, name) {
    const raw = field(record, name);
    const parsed = typeof raw === "number" ? new Date(raw) : new Date(String(raw || ""));
    const value = parsed.getTime();
    return Number.isFinite(value) ? value : 0;
  }

  function booleanValue(record, name) {
    const value = field(record, name);
    return value === true || value === 1 || value === "1" || value === "true";
  }

  function isVisible(record) {
    const value = field(record, "websiteVisible");
    return value == null || booleanValue(record, "websiteVisible");
  }

  function assetURL(record, name) {
    const value = field(record, name);
    const candidate = typeof value === "string" ? value : value?.downloadURL;
    return safeHTTPSURL(candidate);
  }

  function safeHTTPSURL(candidate) {
    if (!candidate) return "";
    try {
      const url = new URL(String(candidate));
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  function createCard(record) {
    const card = document.createElement("article");
    card.className = "musimotion-community-card";

    card.append(createMedia(record));

    const body = document.createElement("div");
    body.className = "musimotion-community-card__body";

    const labels = document.createElement("div");
    labels.className = "musimotion-community-card__labels";
    labels.append(createLabel(previewLabel(record)));
    if (booleanValue(record, "aiAssisted")) labels.append(createLabel("AI-assisted"));
    body.append(labels);

    const title = document.createElement("h3");
    title.textContent = textValue(record, "title", "Untitled Musimotion");
    body.append(title);

    const summary = textValue(record, "summary");
    if (summary) {
      const description = document.createElement("p");
      description.textContent = summary;
      body.append(description);
    }

    const meta = document.createElement("div");
    meta.className = "musimotion-community-card__meta";
    const author = textValue(record, "author", "Musimotion creator");
    meta.append(createMeta(author));

    const duration = numericValue(record, "duration");
    if (duration > 0) meta.append(createMeta(formatDuration(duration)));

    const sceneCount = Math.max(0, Math.round(numericValue(record, "sceneCount")));
    if (sceneCount > 0) meta.append(createMeta(`${sceneCount} ${sceneCount === 1 ? "scene" : "scenes"}`));
    body.append(meta);

    const shareURL = safeHTTPSURL(textValue(record, "shareURL"));
    if (shareURL) {
      const link = document.createElement("a");
      link.href = shareURL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open the experience ↗";
      body.append(link);
    }

    card.append(body);
    return card;
  }

  function createMedia(record) {
    const media = document.createElement("div");
    media.className = "musimotion-community-card__media";
    const preview = assetURL(record, "preview");
    const poster = assetURL(record, "poster");
    const title = textValue(record, "title", "Musimotion creation");

    if (preview) {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.setAttribute("aria-label", `${title} public preview`);
      if (poster) video.poster = poster;
      const source = document.createElement("source");
      source.src = preview;
      source.type = "video/mp4";
      video.append(source);
      media.append(video);
      return media;
    }

    if (poster) {
      const image = document.createElement("img");
      image.src = poster;
      image.alt = `${title} preview`;
      image.loading = "lazy";
      image.decoding = "async";
      media.append(image);
      return media;
    }

    const placeholder = document.createElement("span");
    placeholder.className = "musimotion-community-card__placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "♪";
    media.append(placeholder);
    return media;
  }

  function previewLabel(record) {
    const raw = field(record, "previewWatermarked");
    if (raw == null) return "Public preview";
    return booleanValue(record, "previewWatermarked") ? "Watermarked preview" : "Studio export";
  }

  function createLabel(value) {
    const label = document.createElement("span");
    label.textContent = value;
    return label;
  }

  function createMeta(value) {
    const meta = document.createElement("span");
    meta.textContent = value;
    return meta;
  }

  function formatDuration(seconds) {
    const rounded = Math.max(1, Math.round(seconds));
    const minutes = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return minutes > 0 ? `${minutes}:${String(remainder).padStart(2, "0")}` : `${rounded}s`;
  }
})();
