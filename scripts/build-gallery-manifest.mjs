#!/usr/bin/env node

import { lstat, mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const sourceRoot = path.resolve(
  process.env.GALLERY_SOURCE_DIR || path.join(repositoryRoot, "media/gallery-originals"),
);
const manifestPath = path.resolve(
  process.env.GALLERY_MANIFEST_PATH || path.join(repositoryRoot, "data/galleries.json"),
);
const supportedExtensions = new Map([
  [".heic", "image"],
  [".jpg", "image"],
  [".jpeg", "image"],
  [".png", "image"],
  [".webp", "image"],
  [".mov", "video"],
]);
const safeBaseName = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function compareNames(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertSafeBaseName(value, label) {
  if (
    !safeBaseName.test(value) ||
    value === "." ||
    value === ".." ||
    path.basename(value) !== value ||
    value.length > 255
  ) {
    throw new Error(`${label} is not a safe basename: ${JSON.stringify(value)}`);
  }
}

async function assertDirectoryNotSymlink(directory, label) {
  const metadata = await lstat(directory);
  if (metadata.isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link: ${directory}`);
  }
  if (!metadata.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directory}`);
  }
}

async function buildManifest() {
  await assertDirectoryNotSymlink(sourceRoot, "Gallery source directory");

  const albumEntries = await readdir(sourceRoot, { withFileTypes: true });
  const albums = albumEntries.sort((left, right) => compareNames(left.name, right.name));
  const manifest = [];

  for (const albumEntry of albums) {
    assertSafeBaseName(albumEntry.name, "Gallery album name");
    const albumPath = path.join(sourceRoot, albumEntry.name);

    if (albumEntry.isSymbolicLink()) {
      throw new Error(`Gallery album must not be a symbolic link: ${albumPath}`);
    }
    if (!albumEntry.isDirectory()) {
      throw new Error(`Gallery source root may contain only album directories: ${albumPath}`);
    }

    await assertDirectoryNotSymlink(albumPath, "Gallery album");
    const mediaEntries = await readdir(albumPath, { withFileTypes: true });
    mediaEntries.sort((left, right) => compareNames(left.name, right.name));

    for (const mediaEntry of mediaEntries) {
      assertSafeBaseName(mediaEntry.name, "Gallery media filename");
      const mediaPath = path.join(albumPath, mediaEntry.name);

      if (mediaEntry.isSymbolicLink()) {
        throw new Error(`Gallery media must not be a symbolic link: ${mediaPath}`);
      }
      if (!mediaEntry.isFile()) {
        throw new Error(`Gallery albums may contain only regular files: ${mediaPath}`);
      }

      const extension = path.extname(mediaEntry.name).toLowerCase();
      const kind = supportedExtensions.get(extension);
      if (!kind) {
        continue;
      }

      manifest.push({ album: albumEntry.name, name: mediaEntry.name, kind });
    }
  }

  if (manifest.length === 0) {
    throw new Error(`No supported gallery media found under ${sourceRoot}`);
  }

  const manifestDirectory = path.dirname(manifestPath);
  await mkdir(manifestDirectory, { recursive: true });
  const manifestDirectoryMetadata = await lstat(manifestDirectory);
  if (manifestDirectoryMetadata.isSymbolicLink() || !manifestDirectoryMetadata.isDirectory()) {
    throw new Error(`Gallery manifest directory must be a regular directory: ${manifestDirectory}`);
  }

  try {
    const existingManifest = await lstat(manifestPath);
    if (existingManifest.isSymbolicLink() || !existingManifest.isFile()) {
      throw new Error(`Gallery manifest path must be a regular file: ${manifestPath}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const temporaryPath = `${manifestPath}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await rename(temporaryPath, manifestPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }

  process.stdout.write(
    `Gallery manifest complete: ${manifest.length} media items across ${albums.length} albums.\n`,
  );
}

buildManifest().catch((error) => {
  process.stderr.write(`Gallery manifest failed: ${error.message}\n`);
  process.exitCode = 1;
});
