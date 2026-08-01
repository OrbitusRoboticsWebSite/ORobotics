import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testOrigin = "https://example.invalid";
const basePath = "/ORobotics/";
const destination = await mkdtemp(path.join(os.tmpdir(), "orobotics-subpath-"));
const failures = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const itemPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(itemPath));
    } else if (entry.isFile()) {
      files.push(itemPath);
    }
  }

  return files;
}

try {
  const build = spawnSync(
    "hugo",
    ["--gc", "--minify", "--destination", destination, "--baseURL", `${testOrigin}${basePath}`],
    { cwd: repoRoot, encoding: "utf8" },
  );

  if (build.status !== 0) {
    process.stderr.write(build.stdout || "");
    process.stderr.write(build.stderr || "");
    throw new Error(`Subpath Hugo build exited with status ${build.status ?? "unknown"}.`);
  }

  const files = await walk(destination);
  const htmlFiles = files.filter((file) => path.extname(file) === ".html");

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf8");
    const attributes = html.matchAll(/(?:href|src|srcset|data-gallery-src|data-gallery-poster)=(?:"([^"]*)"|'([^']*)')/gi);

    for (const match of attributes) {
      const value = match[1] ?? match[2] ?? "";
      const urls = value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]);

      for (const url of urls) {
        if (url.startsWith(`${testOrigin}/`) && !url.startsWith(`${testOrigin}${basePath}`)) {
          failures.push(`${path.relative(destination, htmlFile)} escapes the project base path: ${url}`);
        }

        if (url.startsWith("/") && !url.startsWith(basePath) && !url.startsWith("//")) {
          failures.push(`${path.relative(destination, htmlFile)} has a host-root URL: ${url}`);
        }
      }
    }
  }

  const home = await readFile(path.join(destination, "index.html"), "utf8");
  for (const expectedPath of ["makerfaire/", "orbitus/", "contact/", "images/site-logo.svg"]) {
    if (!home.includes(`${basePath}${expectedPath}`)) {
      failures.push(`Homepage is missing subpath-safe URL: ${basePath}${expectedPath}`);
    }
  }

  const cname = (await readFile(path.join(destination, "CNAME"), "utf8")).trim();
  if (cname !== "orbitusrobotics.com") {
    failures.push(`Unexpected CNAME value: ${cname}`);
  }

  if (failures.length > 0) {
    console.error("Subpath validation failed:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`Subpath validation passed for ${htmlFiles.length} HTML files.`);
  }
} finally {
  await rm(destination, { recursive: true, force: true });
}
