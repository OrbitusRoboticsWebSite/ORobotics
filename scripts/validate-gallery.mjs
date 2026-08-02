#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "data", "galleries.json");
const metadataPath = path.join(repoRoot, "data", "gallery_metadata.json");
const sourceRoot = path.join(repoRoot, "media", "gallery-originals");
const staticRoot = path.join(repoRoot, "static");
const captionsRoot = path.join(staticRoot, "captions", "galleries");
const generatedRoot = path.join(repoRoot, "static", "images", "galleries");
const publicRoot = path.join(repoRoot, "public");
const supportedExtensions = new Map([
  [".heic", "image"],
  [".jpg", "image"],
  [".jpeg", "image"],
  [".png", "image"],
  [".webp", "image"],
  [".mov", "video"],
]);
const expectedGeneratedFiles = new Set();
const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function isSafeBaseName(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    value !== "." &&
    value !== ".." &&
    path.basename(value) === value &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function decodeHTMLEntities(value) {
  const namedEntities = new Map([
    ["amp", "&"],
    ["apos", "'"],
    ["gt", ">"],
    ["lt", "<"],
    ["nbsp", " "],
    ["quot", '"'],
  ]);

  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 16)))
    .replace(/&#([0-9]+);/g, (_, digits) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&([a-z]+);/gi, (entity, name) => namedEntities.get(name.toLowerCase()) ?? entity);
}

function readHTMLAttribute(tag, attributeName) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`,
    "i",
  );
  const match = tag.match(pattern);
  if (!match) {
    return null;
  }
  return decodeHTMLEntities(match[1] ?? match[2] ?? match[3] ?? "");
}

function urlMatchesGalleryPath(value, expectedRelativePath) {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(value, "https://example.invalid/");
    const pathname = decodeURIComponent(parsed.pathname);
    return (
      pathname === `/${expectedRelativePath}` ||
      pathname.endsWith(`/${expectedRelativePath}`)
    );
  } catch {
    return false;
  }
}

function normalizeTranscript(value) {
  return decodeHTMLEntities(value.replace(/<[^>]*>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function parseWebVTTTimestamp(value) {
  const match = value.match(/^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) {
    throw new Error(`invalid timestamp ${JSON.stringify(value)}`);
  }

  const hours = match[1] ? Number.parseInt(match[1], 10) : 0;
  const minutes = Number.parseInt(match[2], 10);
  const seconds = Number.parseInt(match[3], 10);
  const milliseconds = Number.parseInt(match[4], 10);
  if (minutes > 59 || seconds > 59) {
    throw new Error(`timestamp is out of range: ${value}`);
  }

  return (((hours * 60) + minutes) * 60 + seconds) * 1000 + milliseconds;
}

function isWebVTTPercentage(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)%$/);
  return Boolean(match) && Number.parseFloat(match[1]) <= 100;
}

function isValidWebVTTCueSetting(name, value) {
  if (name === "vertical") {
    return value === "rl" || value === "lr";
  }
  if (name === "align") {
    return ["start", "center", "end", "left", "right"].includes(value);
  }
  if (name === "size") {
    return isWebVTTPercentage(value);
  }
  if (name === "region") {
    return value.length > 0 && !/\s/.test(value) && !value.includes("-->");
  }

  const [offset, alignment, extra] = value.split(",");
  if (extra !== undefined) {
    return false;
  }
  if (name === "line") {
    const validOffset = /^-?\d+$/.test(offset) || isWebVTTPercentage(offset);
    return validOffset && (
      alignment === undefined ||
      ["start", "center", "end"].includes(alignment)
    );
  }
  if (name === "position") {
    return isWebVTTPercentage(offset) && (
      alignment === undefined ||
      ["line-left", "center", "line-right"].includes(alignment)
    );
  }
  return false;
}

function parseWebVTT(contents) {
  if (typeof contents !== "string") {
    throw new Error("caption content is not text");
  }

  let normalized = contents;
  if (normalized.charCodeAt(0) === 0xfeff) {
    normalized = normalized.slice(1);
  }
  if (normalized.includes("\0")) {
    throw new Error("caption content contains a NUL byte");
  }
  normalized = normalized.replace(/\r\n?/g, "\n").trimEnd();

  const blocks = normalized.split(/\n[ \t]*\n+/);
  const headerLines = (blocks.shift() ?? "").split("\n");
  if (!/^WEBVTT(?:[ \t].*)?$/.test(headerLines[0] ?? "")) {
    throw new Error("missing or malformed WEBVTT header");
  }
  if (headerLines.length !== 1) {
    throw new Error("WEBVTT header must be followed by a blank line");
  }

  const cues = [];
  const cueIdentifiers = new Set();
  let previousStart = -1;

  for (const block of blocks) {
    const lines = block.split("\n");
    const firstLine = lines[0] ?? "";
    if (/^NOTE(?:[ \t]|$)/.test(firstLine)) {
      if (block.includes("-->")) {
        throw new Error("WebVTT comment contains a timing arrow");
      }
      continue;
    }
    const directive = firstLine.trimEnd();
    if (directive === "STYLE" || directive === "REGION") {
      throw new Error(`${directive} blocks are unsupported; gallery captions must use timed cues only`);
    }

    const timingIndex = firstLine.includes("-->") ? 0 : 1;
    if (!lines[timingIndex]?.includes("-->")) {
      throw new Error("caption block has no cue timing line");
    }
    if (timingIndex === 1 && firstLine.trim().length === 0) {
      throw new Error("caption cue identifier is empty");
    }
    if (timingIndex === 1) {
      const cueIdentifier = firstLine.trim();
      if (cueIdentifiers.has(cueIdentifier)) {
        throw new Error(`duplicate cue identifier ${JSON.stringify(cueIdentifier)}`);
      }
      cueIdentifiers.add(cueIdentifier);
    }

    const timing = lines[timingIndex].match(
      /^(\S+)[ \t]+-->[ \t]+(\S+)(?:[ \t]+(.+))?$/,
    );
    if (!timing) {
      throw new Error(`malformed cue timing line: ${lines[timingIndex]}`);
    }

    const start = parseWebVTTTimestamp(timing[1]);
    const end = parseWebVTTTimestamp(timing[2]);
    if (start >= end) {
      throw new Error(`cue start must precede cue end: ${lines[timingIndex]}`);
    }
    if (start < previousStart) {
      throw new Error(`cue starts are not ordered: ${lines[timingIndex]}`);
    }
    previousStart = start;

    const settingNames = new Set();
    for (const setting of (timing[3] ?? "").split(/[ \t]+/).filter(Boolean)) {
      const settingMatch = setting.match(/^(vertical|line|position|size|align|region):(\S+)$/);
      if (!settingMatch) {
        throw new Error(`invalid cue setting ${JSON.stringify(setting)}`);
      }
      if (settingNames.has(settingMatch[1])) {
        throw new Error(`duplicate cue setting ${JSON.stringify(settingMatch[1])}`);
      }
      if (!isValidWebVTTCueSetting(settingMatch[1], settingMatch[2])) {
        throw new Error(`invalid value for cue setting ${JSON.stringify(setting)}`);
      }
      settingNames.add(settingMatch[1]);
    }

    const payloadLines = lines.slice(timingIndex + 1);
    const payload = payloadLines.join("\n").trim();
    if (payload.length === 0) {
      throw new Error("caption cue has no text payload");
    }
    if (payloadLines.some((line) => line.includes("-->"))) {
      throw new Error("caption cue text contains a timing arrow");
    }
    cues.push({ start, end, payload });
  }

  if (cues.length === 0) {
    throw new Error("caption file contains no timed cues");
  }

  return {
    cues,
    transcript: normalizeTranscript(cues.map((cue) => cue.payload).join(" ")),
  };
}

function verifyWebVTTParser() {
  const parsed = parseWebVTT(
    "WEBVTT\n\nintro\n00:00:00.000 --> 00:00:01.500 align:start\nHello, robot.\n",
  );
  if (parsed.cues.length !== 1 || parsed.transcript !== "Hello, robot.") {
    throw new Error("Internal WebVTT parser failed its valid-caption fixture.");
  }

  const rejectedFixtures = [
    "WEBVTT\n\n00:00:05.000 --> 00:00:01.000\nReversed.\n",
    "WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n",
    "WEBVTT\n\n00:00:61.000 --> 00:01:02.000\nOut of range.\n",
    "WEBVTT\n\n00:00:00.000 --> 00:00:01.000 size:101%\nOversized.\n",
    "WEBVTT\n\nrepeat\n00:00:00.000 --> 00:00:01.000\nFirst.\n\nrepeat\n00:00:01.000 --> 00:00:02.000\nSecond.\n",
    "WEBVTT\nKind: captions\n\n00:00:00.000 --> 00:00:01.000\nExtra header line.\n",
    "WEBVTT\n\nSTYLE   \n::cue { color: white; }\n\n00:00:00.000 --> 00:00:01.000\nStyled.\n",
    "WEBVTT\n\nREGION\nbogus\n\n00:00:00.000 --> 00:00:01.000\nRegion.\n",
  ];
  for (const fixture of rejectedFixtures) {
    let rejected = false;
    try {
      parseWebVTT(fixture);
    } catch {
      rejected = true;
    }
    if (!rejected) {
      throw new Error("Internal WebVTT parser accepted an invalid-caption fixture.");
    }
  }
}

async function pathDetails(filePath) {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function walk(directory, label) {
  const details = await pathDetails(directory);
  if (!details?.isDirectory()) {
    failures.push(`Missing ${label} directory: ${path.relative(repoRoot, directory)}`);
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const itemPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(itemPath, label));
    } else {
      files.push(itemPath);
    }
  }

  return files;
}

function readWebPDimensions(buffer, relativePath) {
  let dimensions = null;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + chunkSize;

    if (payloadEnd > buffer.length) {
      failures.push(`Malformed WebP chunk in ${relativePath}: ${chunkType}`);
      return null;
    }

    expect(
      chunkType !== "EXIF" && chunkType !== "XMP ",
      `WebP contains a metadata chunk (${chunkType.trim()}): ${relativePath}`,
    );

    if (!dimensions && chunkType === "VP8X" && chunkSize >= 10) {
      const featureFlags = buffer[payloadStart];
      expect(
        (featureFlags & 0x0c) === 0,
        `WebP VP8X header advertises EXIF/XMP metadata: ${relativePath}`,
      );
      dimensions = {
        width: buffer.readUIntLE(payloadStart + 4, 3) + 1,
        height: buffer.readUIntLE(payloadStart + 7, 3) + 1,
      };
    } else if (!dimensions && chunkType === "VP8 " && chunkSize >= 10) {
      const hasFrameHeader =
        buffer[payloadStart + 3] === 0x9d &&
        buffer[payloadStart + 4] === 0x01 &&
        buffer[payloadStart + 5] === 0x2a;
      if (hasFrameHeader) {
        dimensions = {
          width: buffer.readUInt16LE(payloadStart + 6) & 0x3fff,
          height: buffer.readUInt16LE(payloadStart + 8) & 0x3fff,
        };
      }
    } else if (!dimensions && chunkType === "VP8L" && chunkSize >= 5) {
      if (buffer[payloadStart] === 0x2f) {
        const packedDimensions = buffer.readUInt32LE(payloadStart + 1);
        dimensions = {
          width: (packedDimensions & 0x3fff) + 1,
          height: ((packedDimensions >>> 14) & 0x3fff) + 1,
        };
      }
    }

    offset = payloadEnd + (chunkSize % 2);
  }

  return dimensions;
}

function inspectWebP(buffer, relativePath, expectedWidth = null, expectedHeight = null) {
  const validSignature =
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP";
  expect(validSignature, `Invalid WebP RIFF/WEBP signature: ${relativePath}`);
  if (!validSignature) {
    return;
  }

  const declaredSize = buffer.readUInt32LE(4) + 8;
  expect(declaredSize === buffer.length, `WebP RIFF size does not match file size: ${relativePath}`);

  const dimensions = readWebPDimensions(buffer, relativePath);
  expect(Boolean(dimensions), `WebP dimensions could not be read: ${relativePath}`);
  if (dimensions) {
    expect(
      dimensions.width > 0 && dimensions.height > 0,
      `WebP has invalid dimensions ${dimensions.width}x${dimensions.height}: ${relativePath}`,
    );
    if (expectedWidth !== null && expectedHeight !== null) {
      expect(
        dimensions.width === expectedWidth && dimensions.height === expectedHeight,
        `WebP should be ${expectedWidth}x${expectedHeight}, found ${dimensions.width}x${dimensions.height}: ${relativePath}`,
      );
    } else {
      expect(
        dimensions.width <= 1440 && dimensions.height <= 1440,
        `Display WebP exceeds 1440px, found ${dimensions.width}x${dimensions.height}: ${relativePath}`,
      );
    }
  }

  const searchable = buffer.toString("latin1").toLowerCase();
  const metadataStrings = ["exif\0\0", "xmpmeta", "<?xpacket", "adobe.com/xap"];
  for (const marker of metadataStrings) {
    expect(!searchable.includes(marker), `WebP contains EXIF/XMP metadata (${marker}): ${relativePath}`);
  }
}

function inspectMp4(buffer, relativePath) {
  const validFtyp = buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp";
  expect(validFtyp, `Invalid MP4 ftyp signature: ${relativePath}`);

  const searchable = buffer.toString("latin1").toLowerCase();
  expect(
    searchable.includes("avc1") || searchable.includes("avc3"),
    `MP4 does not declare an H.264 codec marker: ${relativePath}`,
  );

  for (const marker of ["hvc1", "hev1", "hevc", "dvh1", "dvhe"]) {
    expect(!searchable.includes(marker), `MP4 contains an HEVC codec marker (${marker}): ${relativePath}`);
  }

  const locationMarkers = [
    "com.apple.quicktime.location",
    "iso6709",
    "location-eng",
    "location",
    "geotag",
    "gpscoordinates",
    "gpslatitude",
    "gpslongitude",
    "latitude",
    "longitude",
    "\xa9xyz",
  ];
  for (const marker of locationMarkers) {
    expect(!searchable.includes(marker), `MP4 contains location metadata (${marker}): ${relativePath}`);
  }

  try {
    const duration = readMp4DurationMilliseconds(buffer, relativePath);
    expect(
      Number.isFinite(duration) && duration > 0,
      `MP4 has an invalid movie duration: ${relativePath}`,
    );
  } catch (error) {
    failures.push(error.message);
  }
}

function readMp4DurationMilliseconds(buffer, relativePath) {
  let searchOffset = 0;

  while (searchOffset < buffer.length) {
    const typeOffset = buffer.indexOf("mvhd", searchOffset, "ascii");
    if (typeOffset < 4) {
      break;
    }

    const atomStart = typeOffset - 4;
    const atomSize = buffer.readUInt32BE(atomStart);
    const payloadStart = typeOffset + 4;
    const atomEnd = atomStart + atomSize;
    if (atomSize >= 28 && atomEnd <= buffer.length) {
      const version = buffer[payloadStart];
      let timescale;
      let duration;

      if (version === 0 && payloadStart + 20 <= atomEnd) {
        timescale = buffer.readUInt32BE(payloadStart + 12);
        duration = BigInt(buffer.readUInt32BE(payloadStart + 16));
      } else if (version === 1 && payloadStart + 32 <= atomEnd) {
        timescale = buffer.readUInt32BE(payloadStart + 20);
        duration = buffer.readBigUInt64BE(payloadStart + 24);
      }

      if (
        timescale > 0 &&
        duration !== undefined &&
        duration <= BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        return (Number(duration) * 1000) / timescale;
      }
    }

    searchOffset = typeOffset + 4;
  }

  throw new Error(`MP4 movie duration could not be read: ${relativePath}`);
}

async function expectGeneratedFile(relativePath, maximumBytes, inspector) {
  const absolutePath = path.join(generatedRoot, relativePath);
  expectedGeneratedFiles.add(absolutePath);

  try {
    const details = await stat(absolutePath);
    expect(details.isFile(), `Generated path is not a regular file: ${relativePath}`);
    expect(details.size > 0, `Generated file is empty: ${relativePath}`);
    expect(
      details.size <= maximumBytes,
      `Generated file exceeds ${Math.round(maximumBytes / 1024)} KiB: ${relativePath} (${Math.round(details.size / 1024)} KiB)`,
    );
    if (details.isFile() && details.size > 0) {
      inspector(await readFile(absolutePath), relativePath);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      failures.push(`Missing generated file: ${relativePath}`);
      return;
    }
    throw error;
  }
}

async function readManifest() {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read committed gallery manifest ${path.relative(repoRoot, manifestPath)}: ${error.message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Gallery manifest must be a top-level array.");
  }
  if (parsed.length === 0) {
    throw new Error("Gallery manifest contains no media items.");
  }

  const validEntries = [];
  const identities = new Set();
  let previousIdentity = null;

  parsed.forEach((entry, index) => {
    const label = `Manifest entry ${index + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      failures.push(`${label} must be an object.`);
      return;
    }

    const keys = Object.keys(entry).sort(compareNames);
    expect(
      keys.join(",") === "album,kind,name",
      `${label} must contain exactly album, name, and kind.`,
    );

    const safeAlbum = isSafeBaseName(entry.album);
    const safeName = isSafeBaseName(entry.name);
    expect(safeAlbum, `${label} has an unsafe album name.`);
    expect(safeName, `${label} has an unsafe media filename.`);
    expect(entry.kind === "image" || entry.kind === "video", `${label} has an unsupported kind.`);
    if (!safeAlbum || !safeName || (entry.kind !== "image" && entry.kind !== "video")) {
      return;
    }

    const extensionKind = supportedExtensions.get(path.extname(entry.name).toLowerCase());
    expect(Boolean(extensionKind), `${label} has an unsupported media extension: ${entry.name}`);
    expect(
      extensionKind === entry.kind,
      `${label} kind does not match its extension: ${entry.name}`,
    );
    if (!extensionKind || extensionKind !== entry.kind) {
      return;
    }

    const identity = `${entry.album}\0${entry.name}`;
    expect(!identities.has(identity), `${label} duplicates ${entry.album}/${entry.name}.`);
    if (previousIdentity !== null) {
      expect(compareNames(previousIdentity, identity) < 0, `${label} is not in deterministic album/name order.`);
    }
    identities.add(identity);
    previousIdentity = identity;
    validEntries.push(entry);
  });

  return validEntries;
}

async function readGalleryMetadata(manifest) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(metadataPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read committed gallery metadata ${path.relative(repoRoot, metadataPath)}: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gallery metadata must be a top-level object keyed by album/filename.");
  }

  const expectedKeys = new Set(manifest.map((entry) => `${entry.album}/${entry.name}`));
  const metadataKeys = Object.keys(parsed);
  const captionFiles = new Map();
  const altOwners = new Map();
  let pendingCaptionCount = 0;

  expect(
    metadataKeys.length === expectedKeys.size,
    `Gallery metadata should contain ${expectedKeys.size} entries, found ${metadataKeys.length}.`,
  );

  for (const metadataKey of metadataKeys) {
    expect(expectedKeys.has(metadataKey), `Gallery metadata has no manifest item: ${metadataKey}`);
  }
  for (let index = 1; index < metadataKeys.length; index += 1) {
    expect(
      compareNames(metadataKeys[index - 1], metadataKeys[index]) < 0,
      `Gallery metadata keys are not in deterministic order near ${metadataKeys[index]}.`,
    );
  }

  for (const entry of manifest) {
    const metadataKey = `${entry.album}/${entry.name}`;
    const details = parsed[metadataKey];
    const label = `Gallery metadata ${metadataKey}`;

    expect(Boolean(details), `${label} is missing.`);
    if (!details || typeof details !== "object" || Array.isArray(details)) {
      expect(false, `${label} must be an object.`);
      continue;
    }

    const allowedKeys = entry.kind === "video"
      ? new Set(["alt", "caption", "captions", "captionStatus", "transcript"])
      : new Set(["alt", "caption"]);
    for (const key of Object.keys(details)) {
      expect(allowedKeys.has(key), `${label} contains unsupported field ${JSON.stringify(key)}.`);
    }

    const alt = details.alt;
    const validAlt = typeof alt === "string" && alt.trim().length > 0;
    expect(validAlt, `${label} must contain nonempty alt text.`);
    if (validAlt) {
      expect(alt === alt.trim(), `${label} alt text has leading or trailing whitespace.`);
      expect(alt.length >= 24 && alt.length <= 240, `${label} alt text should be 24-240 characters.`);
      expect(
        !/^(?:image|photo|picture|video)(?:\s+\d+)?(?:\s+of)?\b/i.test(alt),
        `${label} alt text starts with a generic media label.`,
      );
      const priorOwner = altOwners.get(alt);
      expect(!priorOwner, `${label} duplicates alt text from ${priorOwner}.`);
      altOwners.set(alt, metadataKey);
    }

    if (Object.hasOwn(details, "caption")) {
      const validCaption = typeof details.caption === "string" && details.caption.trim().length > 0;
      expect(
        validCaption,
        `${label} caption must be a nonempty string when provided.`,
      );
      if (validCaption) {
        expect(
          details.caption === details.caption.trim(),
          `${label} caption has leading or trailing whitespace.`,
        );
      }
    }

    const hasCaptions = Object.hasOwn(details, "captions");
    const hasTranscript = Object.hasOwn(details, "transcript");
    const hasCaptionStatus = Object.hasOwn(details, "captionStatus");
    expect(
      hasCaptions === hasTranscript,
      `${label} must provide both captions and transcript, or neither.`,
    );
    if (entry.kind === "video") {
      expect(
        hasCaptions || hasCaptionStatus,
        `${label} must provide captions/transcript or an explicit pending captionStatus.`,
      );
      if (hasCaptionStatus) {
        expect(
          details.captionStatus === "pending-transcription",
          `${label} captionStatus must be "pending-transcription".`,
        );
        expect(
          !hasCaptions && !hasTranscript,
          `${label} must remove captionStatus after captions and transcript are added.`,
        );
        if (details.captionStatus === "pending-transcription") {
          pendingCaptionCount += 1;
        }
      }
    }

    if (hasCaptions && hasTranscript) {
      const captions = details.captions;
      const transcript = details.transcript;
      const captionSegments = typeof captions === "string" ? captions.split("/") : [];
      const validCaptions =
        typeof captions === "string" &&
        captionSegments.length === 4 &&
        captionSegments[0] === "captions" &&
        captionSegments[1] === "galleries" &&
        captionSegments[2] === entry.album &&
        isSafeBaseName(captionSegments[3]) &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*\.vtt$/.test(captionSegments[3]) &&
        !path.isAbsolute(captions) &&
        !captions.includes("\\");
      expect(
        validCaptions,
        `${label} captions must be a safe captions/galleries/${entry.album}/*.vtt path.`,
      );
      const validTranscript = typeof transcript === "string" && transcript.trim().length > 0;
      expect(validTranscript, `${label} transcript must be a nonempty string.`);
      if (validTranscript) {
        expect(
          transcript === transcript.trim(),
          `${label} transcript has leading or trailing whitespace.`,
        );
      }
      if (validCaptions) {
        const priorOwner = captionFiles.get(captions);
        expect(
          !priorOwner,
          `${label} reuses caption file from ${priorOwner?.metadataKey}: ${captions}`,
        );
        if (!priorOwner) {
          captionFiles.set(captions, {
            album: entry.album,
            metadataKey,
            transcript: validTranscript ? transcript : "",
            videoRelativePath: path.join(entry.album, "video", `${entry.name}.mp4`),
          });
        }
      }
    }
  }

  return {
    captionFiles,
    count: metadataKeys.length,
    entries: parsed,
    pendingCaptionCount,
  };
}

async function validateCaptionFile(relativePath, captionRecord) {
  const absolutePath = path.resolve(staticRoot, relativePath);
  const staticPrefix = `${staticRoot}${path.sep}`;
  expect(absolutePath.startsWith(staticPrefix), `Caption path escapes static/: ${relativePath}`);
  if (!absolutePath.startsWith(staticPrefix)) {
    return;
  }

  const details = await pathDetails(absolutePath);
  expect(details?.isFile(), `Missing WebVTT caption file: ${relativePath}`);
  if (!details?.isFile()) {
    return;
  }

  const contents = await readFile(absolutePath, "utf8");
  let parsed;
  try {
    parsed = parseWebVTT(contents);
  } catch (error) {
    failures.push(`Invalid WebVTT caption file ${relativePath}: ${error.message}`);
    return;
  }

  expect(
    parsed.transcript === normalizeTranscript(captionRecord.transcript),
    `WebVTT cue text does not match metadata transcript: ${relativePath}`,
  );

  const videoPath = path.join(generatedRoot, captionRecord.videoRelativePath);
  const videoDetails = await pathDetails(videoPath);
  if (videoDetails?.isFile()) {
    try {
      const duration = readMp4DurationMilliseconds(
        await readFile(videoPath),
        captionRecord.videoRelativePath,
      );
      const finalCueEnd = Math.max(...parsed.cues.map((cue) => cue.end));
      expect(
        finalCueEnd <= duration + 500,
        `WebVTT cues exceed video duration by more than 500 ms: ${relativePath}`,
      );
    } catch (error) {
      failures.push(error.message);
    }
  }
}

async function validateCaptionInventory(captionFiles) {
  const rootDetails = await pathDetails(captionsRoot);
  if (!rootDetails) {
    expect(captionFiles.size === 0, "Caption metadata exists but static/captions/galleries is missing.");
    return new Set();
  }

  expect(rootDetails.isDirectory(), "Caption asset path is not a directory: static/captions/galleries");
  if (!rootDetails.isDirectory()) {
    return new Set();
  }

  const actualCaptionPaths = new Set();
  for (const captionFile of await walk(captionsRoot, "gallery captions")) {
    const relativePath = path.relative(staticRoot, captionFile).split(path.sep).join("/");
    if (path.extname(captionFile).toLowerCase() !== ".vtt") {
      failures.push(`Unexpected non-WebVTT file in caption directory: ${relativePath}`);
      continue;
    }
    actualCaptionPaths.add(relativePath);
  }

  for (const relativePath of captionFiles.keys()) {
    expect(actualCaptionPaths.has(relativePath), `Missing referenced WebVTT caption file: ${relativePath}`);
  }
  for (const relativePath of actualCaptionPaths) {
    expect(captionFiles.has(relativePath), `Orphan WebVTT caption file is not referenced by metadata: ${relativePath}`);
  }
  return actualCaptionPaths;
}

async function compareOptionalOriginals(manifest) {
  const rootDetails = await pathDetails(sourceRoot);
  if (!rootDetails) {
    return false;
  }
  expect(rootDetails.isDirectory(), `Optional gallery source path is not a directory: ${path.relative(repoRoot, sourceRoot)}`);
  if (!rootDetails.isDirectory()) {
    return false;
  }

  const manifestNames = new Set(manifest.map((entry) => `${entry.album}\0${entry.name}`));
  const sourceNames = new Set();
  const albumEntries = await readdir(sourceRoot, { withFileTypes: true });

  for (const albumEntry of albumEntries) {
    if (!albumEntry.isDirectory()) {
      continue;
    }
    const mediaEntries = await readdir(path.join(sourceRoot, albumEntry.name), { withFileTypes: true });
    for (const mediaEntry of mediaEntries) {
      if (!mediaEntry.isFile() || !supportedExtensions.has(path.extname(mediaEntry.name).toLowerCase())) {
        continue;
      }
      sourceNames.add(`${albumEntry.name}\0${mediaEntry.name}`);
    }
  }

  for (const identity of manifestNames) {
    expect(sourceNames.has(identity), `Local originals are missing manifest item: ${identity.replace("\0", "/")}`);
  }
  for (const identity of sourceNames) {
    expect(manifestNames.has(identity), `Local original is missing from manifest: ${identity.replace("\0", "/")}`);
  }

  return true;
}

async function main() {
  verifyWebVTTParser();
  const manifest = await readManifest();
  const metadata = await readGalleryMetadata(manifest);
  const albums = new Set(manifest.map((entry) => entry.album));
  const comparedOriginals = await compareOptionalOriginals(manifest);

  const actualCaptionPaths = await validateCaptionInventory(metadata.captionFiles);
  for (const [captionPath, captionRecord] of metadata.captionFiles) {
    if (actualCaptionPaths.has(captionPath)) {
      await validateCaptionFile(captionPath, captionRecord);
    }
  }

  for (const entry of manifest) {
    const prefix = path.join(entry.album, "thumb", entry.name);
    await expectGeneratedFile(`${prefix}-320.webp`, 120 * 1024, (buffer, relativePath) => {
      inspectWebP(buffer, relativePath, 320, 240);
    });
    await expectGeneratedFile(`${prefix}-640.webp`, 260 * 1024, (buffer, relativePath) => {
      inspectWebP(buffer, relativePath, 640, 480);
    });
    await expectGeneratedFile(
      path.join(entry.album, "display", `${entry.name}.webp`),
      1280 * 1024,
      inspectWebP,
    );

    if (entry.kind === "video") {
      await expectGeneratedFile(
        path.join(entry.album, "video", `${entry.name}.mp4`),
        30 * 1024 * 1024,
        inspectMp4,
      );
    }
  }

  const generatedFiles = await walk(generatedRoot, "generated gallery");
  for (const generatedFile of generatedFiles) {
    expect(
      expectedGeneratedFiles.has(generatedFile),
      `Unexpected or stale generated file: ${path.relative(generatedRoot, generatedFile)}`,
    );
  }

  for (const album of albums) {
    const legacyAlbumPath = path.join(publicRoot, "images", album);
    expect(
      !(await pathDetails(legacyAlbumPath)),
      `Legacy source album is published: ${path.relative(publicRoot, legacyAlbumPath)}`,
    );
  }

  const publicFiles = await walk(publicRoot, "published site");
  let publicBytes = 0;
  for (const publicFile of publicFiles) {
    const details = await stat(publicFile);
    publicBytes += details.size;
    const extension = path.extname(publicFile).toLowerCase();
    expect(extension !== ".heic", `Published HEIC original: ${path.relative(publicRoot, publicFile)}`);
    expect(extension !== ".mov", `Published MOV original: ${path.relative(publicRoot, publicFile)}`);
  }
  expect(
    publicBytes <= 350 * 1024 * 1024,
    `Published site exceeds 350 MiB: ${(publicBytes / 1024 / 1024).toFixed(1)} MiB`,
  );

  const htmlFiles = publicFiles.filter((file) => path.extname(file).toLowerCase() === ".html");
  const manifestByKey = new Map(manifest.map((entry) => [`${entry.album}/${entry.name}`, entry]));
  const renderedKeys = new Map();
  let galleryPageCount = 0;

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8");
    const htmlLabel = path.relative(publicRoot, htmlFile);
    expect(!/jquery|fancybox/i.test(html), `Legacy gallery dependency remains in ${htmlLabel}`);
    expect(
      !/(?:src|href)=["']?[^\s"'>]+\.(?:heic|mov)(?:[\s"'?#>])/i.test(html),
      `Raw gallery media URL remains in ${htmlLabel}`,
    );

    if (!html.includes("data-gallery")) {
      continue;
    }

    galleryPageCount += 1;
    const pageCaptionKeys = new Set();
    const pageMediaBlocks = html.match(
      /<a\b[^>]*\bdata-gallery-open(?:\s|=)[^>]*>[\s\S]*?<\/a>/gi,
    ) || [];
    expect(pageMediaBlocks.length > 0, `Gallery page has no media links: ${htmlLabel}`);

    for (const mediaBlock of pageMediaBlocks) {
      const mediaLink = mediaBlock.match(/^<a\b[^>]*>/i)?.[0] ?? "";
      const mediaKey = readHTMLAttribute(mediaLink, "data-gallery-key");
      expect(Boolean(mediaKey), `Gallery link lacks a stable media key in ${htmlLabel}`);
      if (!mediaKey) {
        continue;
      }

      const manifestEntry = manifestByKey.get(mediaKey);
      expect(Boolean(manifestEntry), `Rendered gallery link has no manifest item in ${htmlLabel}: ${mediaKey}`);
      const priorPage = renderedKeys.get(mediaKey);
      expect(!priorPage, `Rendered gallery item ${mediaKey} appears in both ${priorPage} and ${htmlLabel}`);
      if (!priorPage) {
        renderedKeys.set(mediaKey, htmlLabel);
      }
      if (!manifestEntry) {
        continue;
      }

      const details = metadata.entries[mediaKey];
      if (!details || typeof details !== "object" || Array.isArray(details)) {
        continue;
      }
      const renderedAlt = readHTMLAttribute(mediaLink, "data-gallery-alt");
      expect(
        renderedAlt === details.alt,
        `Rendered gallery alt text does not match metadata in ${htmlLabel}: ${mediaKey}`,
      );
      expect(
        readHTMLAttribute(mediaLink, "data-gallery-kind") === manifestEntry.kind,
        `Rendered gallery kind does not match manifest in ${htmlLabel}: ${mediaKey}`,
      );

      const galleryBase = `images/galleries/${manifestEntry.album}`;
      const expectedDisplay = `${galleryBase}/display/${manifestEntry.name}.webp`;
      const expectedSource = manifestEntry.kind === "video"
        ? `${galleryBase}/video/${manifestEntry.name}.mp4`
        : expectedDisplay;
      for (const [attributeName, expectedPath] of [
        ["href", expectedSource],
        ["data-gallery-src", expectedSource],
        ["data-gallery-poster", expectedDisplay],
      ]) {
        expect(
          urlMatchesGalleryPath(readHTMLAttribute(mediaLink, attributeName), expectedPath),
          `Rendered ${attributeName} does not match ${mediaKey} in ${htmlLabel}`,
        );
      }

      const thumbnail = mediaBlock.match(/<img\b[^>]*\bmedia-gallery__thumbnail\b[^>]*>/i)?.[0];
      expect(Boolean(thumbnail), `Rendered gallery item has no thumbnail in ${htmlLabel}: ${mediaKey}`);
      if (thumbnail) {
        const expectedThumbnail320 = `${galleryBase}/thumb/${manifestEntry.name}-320.webp`;
        const expectedThumbnail640 = `${galleryBase}/thumb/${manifestEntry.name}-640.webp`;
        expect(
          urlMatchesGalleryPath(readHTMLAttribute(thumbnail, "src"), expectedThumbnail320),
          `Rendered thumbnail src does not match ${mediaKey} in ${htmlLabel}`,
        );
        const srcsetURLs = (readHTMLAttribute(thumbnail, "srcset") ?? "")
          .split(",")
          .map((candidate) => candidate.trim().split(/\s+/)[0])
          .filter(Boolean);
        expect(
          srcsetURLs.some((url) => urlMatchesGalleryPath(url, expectedThumbnail320)) &&
            srcsetURLs.some((url) => urlMatchesGalleryPath(url, expectedThumbnail640)),
          `Rendered thumbnail srcset does not match ${mediaKey} in ${htmlLabel}`,
        );
        expect(
          readHTMLAttribute(thumbnail, "alt") === details.alt,
          `Rendered thumbnail alt text does not match metadata in ${htmlLabel}: ${mediaKey}`,
        );
      }

      const renderedCaption = readHTMLAttribute(mediaLink, "data-gallery-caption");
      const expectedCaption = Object.hasOwn(details, "caption") ? details.caption : null;
      expect(
        renderedCaption === expectedCaption,
        `Rendered editorial caption does not match metadata in ${htmlLabel}: ${mediaKey}`,
      );

      const renderedCaptionsURL = readHTMLAttribute(mediaLink, "data-gallery-captions");
      const renderedTranscript = readHTMLAttribute(mediaLink, "data-gallery-transcript");
      const hasCaptionMetadata = Object.hasOwn(details, "captions");
      expect(
        (renderedCaptionsURL !== null) === hasCaptionMetadata,
        `Rendered WebVTT attribute does not match metadata in ${htmlLabel}: ${mediaKey}`,
      );
      expect(
        (renderedTranscript !== null) === hasCaptionMetadata,
        `Rendered transcript attribute does not match metadata in ${htmlLabel}: ${mediaKey}`,
      );
      if (hasCaptionMetadata) {
        pageCaptionKeys.add(mediaKey);
        if (renderedCaptionsURL !== null) {
          expect(
            urlMatchesGalleryPath(renderedCaptionsURL, details.captions),
            `Rendered WebVTT URL does not match metadata in ${htmlLabel}: ${mediaKey}`,
          );
        }
        expect(
          typeof details.transcript === "string" &&
            normalizeTranscript(renderedTranscript ?? "") === normalizeTranscript(details.transcript),
          `Rendered transcript does not match metadata in ${htmlLabel}: ${mediaKey}`,
        );
      }
    }

    const archiveEntryBlocks = html.match(
      /<details\b[^>]*\bdata-gallery-transcript-entry(?:\s|=)[^>]*>[\s\S]*?<\/details>/gi,
    ) || [];
    const archiveKeys = new Set();

    for (const archiveBlock of archiveEntryBlocks) {
      const archiveOpening = archiveBlock.match(/^<details\b[^>]*>/i)?.[0] ?? "";
      const mediaKey = readHTMLAttribute(archiveOpening, "data-gallery-transcript-entry");
      expect(Boolean(mediaKey), `Transcript archive entry lacks a media key in ${htmlLabel}`);
      if (!mediaKey) {
        continue;
      }

      expect(
        pageCaptionKeys.has(mediaKey),
        `Transcript archive has no matching captioned gallery item in ${htmlLabel}: ${mediaKey}`,
      );
      expect(
        !archiveKeys.has(mediaKey),
        `Transcript archive duplicates ${mediaKey} in ${htmlLabel}`,
      );
      archiveKeys.add(mediaKey);

      const details = metadata.entries[mediaKey];
      const manifestEntry = manifestByKey.get(mediaKey);
      if (
        !details ||
        typeof details !== "object" ||
        typeof details.transcript !== "string" ||
        typeof details.captions !== "string" ||
        !manifestEntry
      ) {
        continue;
      }

      const copyBlock = archiveBlock.match(
        /<p\b[^>]*\bdata-gallery-transcript-copy\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>\x60]+)[^>]*>[\s\S]*?<\/p>/i,
      )?.[0];
      expect(Boolean(copyBlock), `Transcript archive entry has no transcript copy in ${htmlLabel}: ${mediaKey}`);
      if (copyBlock) {
        const copyOpening = copyBlock.match(/^<p\b[^>]*>/i)?.[0] ?? "";
        const visibleCopy = copyBlock
          .replace(/^<p\b[^>]*>/i, "")
          .replace(/<\/p>$/i, "");
        expect(
          normalizeTranscript(readHTMLAttribute(copyOpening, "data-gallery-transcript-copy") ?? "") ===
            normalizeTranscript(details.transcript) &&
            normalizeTranscript(visibleCopy) === normalizeTranscript(details.transcript),
          `Transcript archive text does not match metadata in ${htmlLabel}: ${mediaKey}`,
        );
      }

      const videoLink = archiveBlock.match(
        /<a\b[^>]*\bdata-gallery-transcript-video(?:\s|=)[^>]*>/i,
      )?.[0];
      const captionsLink = archiveBlock.match(
        /<a\b[^>]*\bdata-gallery-transcript-vtt(?:\s|=)[^>]*>/i,
      )?.[0];
      const expectedVideo = `images/galleries/${manifestEntry.album}/video/${manifestEntry.name}.mp4`;
      expect(
        Boolean(videoLink) &&
          urlMatchesGalleryPath(readHTMLAttribute(videoLink, "href"), expectedVideo),
        `Transcript archive video link does not match metadata in ${htmlLabel}: ${mediaKey}`,
      );
      expect(
        Boolean(captionsLink) &&
          urlMatchesGalleryPath(readHTMLAttribute(captionsLink, "href"), details.captions),
        `Transcript archive WebVTT link does not match metadata in ${htmlLabel}: ${mediaKey}`,
      );
    }

    if (pageCaptionKeys.size > 0) {
      expect(
        /<section\b[^>]*class=(?:"[^"]*media-gallery__transcripts[^"]*"|'[^']*media-gallery__transcripts[^']*'|[^\s>]*media-gallery__transcripts[^\s>]*)/i.test(html),
        `Gallery page with captions lacks an always-available transcript archive: ${htmlLabel}`,
      );
      expect(
        archiveKeys.size === pageCaptionKeys.size,
        `Transcript archive should contain ${pageCaptionKeys.size} entries, found ${archiveKeys.size} in ${htmlLabel}`,
      );
      for (const mediaKey of pageCaptionKeys) {
        expect(
          archiveKeys.has(mediaKey),
          `Captioned gallery item is missing from transcript archive in ${htmlLabel}: ${mediaKey}`,
        );
      }
    } else {
      expect(
        archiveEntryBlocks.length === 0,
        `Transcript archive contains entries without caption metadata in ${htmlLabel}`,
      );
    }

    const liveGrids = html.match(/<ul[^>]*data-gallery-grid[^>]*>[\s\S]*?<\/ul>/gi) || [];
    expect(liveGrids.length > 0, `Gallery page has no live grid: ${htmlLabel}`);

    for (const grid of liveGrids) {
      const itemCount = (grid.match(/data-gallery-item/g) || []).length;
      expect(
        itemCount > 0 && itemCount <= 12,
        `Gallery live grid should contain 1-12 items, found ${itemCount} in ${htmlLabel}`,
      );

      const imageTags = grid.match(/<img\b[^>]*>/gi) || [];
      for (const imageTag of imageTags) {
        expect(/loading=(?:["']lazy["']|lazy)(?:\s|>)/i.test(imageTag), `Gallery image is not lazy-loaded in ${htmlLabel}`);
        expect(/decoding=(?:["']async["']|async)(?:\s|>)/i.test(imageTag), `Gallery image is not asynchronously decoded in ${htmlLabel}`);
        expect(
          /width=(?:["']320["']|320)(?:\s|>)/i.test(imageTag) &&
            /height=(?:["']240["']|240)(?:\s|>)/i.test(imageTag),
          `Gallery image lacks intrinsic dimensions in ${htmlLabel}`,
        );
        expect(/srcset=/i.test(imageTag), `Gallery image lacks a responsive srcset in ${htmlLabel}`);
        expect(/sizes=/i.test(imageTag), `Gallery image lacks responsive sizes in ${htmlLabel}`);
        expect(
          /\balt=(?:"[^"\s][^"]*"|'[^'\s][^']*')/i.test(imageTag),
          `Gallery image lacks meaningful alt text in ${htmlLabel}`,
        );
      }

      const mediaLinks = grid.match(/<a\b[^>]*data-gallery-open[^>]*>/gi) || [];
      for (const mediaLink of mediaLinks) {
        expect(
          Boolean(readHTMLAttribute(mediaLink, "data-gallery-alt")?.trim()),
          `Gallery link lacks descriptive lightbox text in ${htmlLabel}`,
        );
      }
    }
  }

  expect(galleryPageCount > 0, "No generated gallery pages were found.");
  expect(
    renderedKeys.size === manifestByKey.size,
    `Generated gallery pages should render ${manifestByKey.size} unique media items, found ${renderedKeys.size}.`,
  );
  for (const mediaKey of manifestByKey.keys()) {
    expect(renderedKeys.has(mediaKey), `Manifest item is missing from generated gallery pages: ${mediaKey}`);
  }

  if (failures.length > 0) {
    console.error("Gallery validation failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  const originalsNote = comparedOriginals ? ", local originals matched" : "";
  console.log(
    `Gallery validation passed: ${manifest.length} manifest items, ${metadata.count} descriptions, ${metadata.captionFiles.size} caption files, ${metadata.pendingCaptionCount} videos pending transcription, ${generatedFiles.length} optimized files, ${galleryPageCount} gallery pages, ${(publicBytes / 1024 / 1024).toFixed(1)} MiB published${originalsNote}.`,
  );
}

main().catch((error) => {
  console.error(`Gallery validation failed: ${error.message}`);
  process.exitCode = 1;
});
