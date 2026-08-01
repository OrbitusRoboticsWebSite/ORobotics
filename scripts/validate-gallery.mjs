#!/usr/bin/env node

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(repoRoot, "data", "galleries.json");
const sourceRoot = path.join(repoRoot, "media", "gallery-originals");
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
  const manifest = await readManifest();
  const albums = new Set(manifest.map((entry) => entry.album));
  const comparedOriginals = await compareOptionalOriginals(manifest);

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
      }
    }
  }

  expect(galleryPageCount > 0, "No generated gallery pages were found.");

  if (failures.length > 0) {
    console.error("Gallery validation failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
    return;
  }

  const originalsNote = comparedOriginals ? ", local originals matched" : "";
  console.log(
    `Gallery validation passed: ${manifest.length} manifest items, ${generatedFiles.length} optimized files, ${galleryPageCount} gallery pages, ${(publicBytes / 1024 / 1024).toFixed(1)} MiB published${originalsNote}.`,
  );
}

main().catch((error) => {
  console.error(`Gallery validation failed: ${error.message}`);
  process.exitCode = 1;
});
