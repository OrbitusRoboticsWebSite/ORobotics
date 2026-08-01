#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cssPath = path.join(repoRoot, "assets", "css", "style.css");
const css = await readFile(cssPath, "utf8");
const normalizedCss = css.replace(/[ \t]+$/gm, "");

if (normalizedCss !== css) {
  await writeFile(cssPath, normalizedCss, "utf8");
}
