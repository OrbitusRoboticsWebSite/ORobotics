const PLAIN_PRIMARY_BUTTON = 0;

function isPlainPrimaryClick(event) {
  return event.button === PLAIN_PRIMARY_BUTTON
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey;
}

function initializeGallery(gallery) {
  const grid = gallery.querySelector("[data-gallery-grid]");
  const itemTemplate = gallery.querySelector("[data-gallery-template]");
  const moreButton = gallery.querySelector("[data-gallery-more]");
  const actions = gallery.querySelector("[data-gallery-actions]");
  const shownCount = gallery.querySelector("[data-gallery-shown]");
  const dialog = gallery.querySelector("[data-gallery-dialog]");
  const dialogImage = gallery.querySelector("[data-gallery-image]");
  const dialogVideo = gallery.querySelector("[data-gallery-video]");
  const caption = gallery.querySelector("[data-gallery-caption-text]");
  const transcriptContainer = gallery.querySelector("[data-gallery-transcript-container]");
  const transcriptText = gallery.querySelector("[data-gallery-transcript-text]");
  const position = gallery.querySelector("[data-gallery-position]");
  const announcement = gallery.querySelector("[data-gallery-announcement]");
  const previousButton = gallery.querySelector("[data-gallery-previous]");
  const nextButton = gallery.querySelector("[data-gallery-next]");
  const batchSize = Number.parseInt(gallery.dataset.batchSize || "12", 10);

  if (!grid) {
    return;
  }

  let currentIndex = 0;
  let lastOpener = null;
  let captionsMode = "showing";

  const visibleLinks = () => Array.from(grid.querySelectorAll("[data-gallery-open]"));

  function stopVideo() {
    if (!dialogVideo) {
      return;
    }

    dialogVideo.pause();
    const managedTrack = dialogVideo.querySelector("[data-gallery-track]");
    if (managedTrack?.track && ["disabled", "hidden", "showing"].includes(managedTrack.track.mode)) {
      captionsMode = managedTrack.track.mode;
    }
    dialogVideo.removeAttribute("src");
    dialogVideo.removeAttribute("poster");
    dialogVideo.querySelectorAll("[data-gallery-track]").forEach((track) => track.remove());
    dialogVideo.load();
  }

  function showLink(link) {
    if (!dialog || !dialogImage || !dialogVideo || !caption || !position) {
      return;
    }

    const links = visibleLinks();
    const requestedIndex = links.indexOf(link);
    if (requestedIndex < 0) {
      return;
    }

    currentIndex = requestedIndex;
    const kind = link.dataset.galleryKind;
    const alt = link.dataset.galleryAlt || "";
    const editorialCaption = link.dataset.galleryCaption || "";
    const label = editorialCaption || alt;
    const captionsURL = link.dataset.galleryCaptions || "";
    const transcript = link.dataset.galleryTranscript || "";
    const describedBy = editorialCaption && editorialCaption !== alt
      ? `${caption.id} ${position.id}`
      : position.id;

    stopVideo();
    dialogImage.hidden = true;
    dialogImage.removeAttribute("src");
    dialogImage.alt = "";
    dialogVideo.hidden = true;
    dialogImage.setAttribute("aria-describedby", describedBy);
    dialogVideo.setAttribute("aria-describedby", describedBy);

    if (transcriptContainer && transcriptText) {
      transcriptContainer.hidden = transcript.length === 0;
      transcriptContainer.open = false;
      transcriptText.textContent = transcript;
    }

    if (kind === "video") {
      dialogVideo.poster = link.dataset.galleryPoster || "";
      if (captionsURL) {
        const captionsTrack = document.createElement("track");
        captionsTrack.dataset.galleryTrack = "";
        captionsTrack.kind = "captions";
        captionsTrack.label = "English";
        captionsTrack.srclang = "en";
        captionsTrack.src = captionsURL;
        captionsTrack.default = captionsMode === "showing";
        dialogVideo.appendChild(captionsTrack);
        captionsTrack.track.mode = captionsMode;
      }
      dialogVideo.src = link.dataset.gallerySrc;
      dialogVideo.setAttribute("aria-label", alt || label);
      dialogVideo.hidden = false;
      dialogVideo.load();
    } else {
      dialogImage.src = link.dataset.gallerySrc;
      dialogImage.alt = alt || label;
      dialogImage.hidden = false;
    }

    caption.textContent = label;
    position.textContent = `${currentIndex + 1} of ${links.length} loaded`;
    if (announcement) {
      announcement.textContent = `${label} Item ${currentIndex + 1} of ${links.length} loaded.`;
    }
    const hasMultipleItems = links.length > 1;
    previousButton.hidden = !hasMultipleItems;
    nextButton.hidden = !hasMultipleItems;
  }

  function step(direction) {
    const links = visibleLinks();
    if (links.length < 2) {
      return;
    }

    currentIndex = (currentIndex + direction + links.length) % links.length;
    showLink(links[currentIndex]);
  }

  if (moreButton && itemTemplate) {
    if (actions) {
      actions.hidden = false;
    }
    moreButton.addEventListener("click", () => {
      const pendingItems = Array.from(itemTemplate.content.children);
      const nextItems = pendingItems.slice(0, batchSize);
      if (nextItems.length === 0) {
        moreButton.remove();
        return;
      }

      const fragment = document.createDocumentFragment();
      nextItems.forEach((item) => fragment.appendChild(item));
      grid.appendChild(fragment);

      const remaining = itemTemplate.content.children.length;
      const loaded = visibleLinks().length;
      shownCount.textContent = String(loaded);
      moreButton.textContent = remaining > 0
        ? `Show ${Math.min(batchSize, remaining)} more`
        : "All media loaded";

      const firstNewLink = nextItems[0].querySelector("[data-gallery-open]");
      if (firstNewLink) {
        firstNewLink.focus();
      }

      if (remaining === 0) {
        moreButton.remove();
      }
    });
  }

  gallery.addEventListener("click", (event) => {
    const link = event.target.closest("[data-gallery-open]");
    if (!link || !gallery.contains(link) || !isPlainPrimaryClick(event)) {
      return;
    }

    if (!dialog || typeof dialog.showModal !== "function") {
      return;
    }

    event.preventDefault();
    lastOpener = link;
    if (!dialog.open) {
      dialog.showModal();
    }
    showLink(link);
  });

  if (dialog) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    dialog.addEventListener("keydown", (event) => {
      if (event.target.closest("video, audio, input, textarea, select, [contenteditable], [data-gallery-transcript-container]")) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    });

    dialog.addEventListener("close", () => {
      stopVideo();
      dialogImage?.removeAttribute("src");
      if (lastOpener?.isConnected) {
        lastOpener.focus();
      }
    });
  }

  previousButton?.addEventListener("click", () => step(-1));
  nextButton?.addEventListener("click", () => step(1));
}

function initializeGalleries() {
  document.querySelectorAll("[data-gallery]").forEach(initializeGallery);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeGalleries, { once: true });
} else {
  initializeGalleries();
}
