import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
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
const referencedFiles = new Set();

function attributeValue(tag, attributeName) {
  const pattern = new RegExp(
    `\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\\x60]+))`,
    "i",
  );
  const match = tag.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

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
  const configResult = spawnSync("hugo", ["config", "--format", "json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (configResult.status !== 0) {
    process.stderr.write(configResult.stdout || "");
    process.stderr.write(configResult.stderr || "");
    throw new Error(`Hugo config inspection exited with status ${configResult.status ?? "unknown"}.`);
  }

  let projectConfig;
  try {
    projectConfig = JSON.parse(configResult.stdout);
  } catch {
    throw new Error("Hugo config inspection did not return valid JSON.");
  }

  const configuredSocialURLs = new Map();
  for (const [configKey, social] of Object.entries(projectConfig.params?.social_media ?? {})) {
    if (social.enabled !== true) {
      continue;
    }
    if (typeof social.slug !== "string" || social.slug === "") {
      failures.push(`Enabled social configuration ${configKey} is missing a QR3D slug.`);
      continue;
    }
    if (typeof social.url !== "string" || social.url === "") {
      failures.push(`Enabled social configuration ${configKey} is missing a URL.`);
      continue;
    }
    if (configuredSocialURLs.has(social.slug)) {
      failures.push(`Enabled social configuration reuses the QR3D slug ${social.slug}.`);
      continue;
    }
    configuredSocialURLs.set(social.slug, social.url);
  }

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
    const htmlRelativePath = path.relative(destination, htmlFile).split(path.sep).join("/");
    const pagePath = htmlRelativePath === "index.html"
      ? basePath
      : htmlRelativePath.endsWith("/index.html")
        ? `${basePath}${htmlRelativePath.slice(0, -"index.html".length)}`
        : `${basePath}${htmlRelativePath}`;
    const pageURL = new URL(pagePath, testOrigin);
    const attributes = html.matchAll(
      /\b(href|src|srcset|data-gallery-src|data-gallery-poster|data-gallery-captions)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+))/gi,
    );

    for (const match of attributes) {
      const attributeName = match[1].toLowerCase();
      const value = match[2] ?? match[3] ?? match[4] ?? "";
      const urls = attributeName === "srcset"
        ? value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0])
        : [value.trim()];

      for (const url of urls) {
        if (url === "" || url.startsWith("#")) {
          continue;
        }

        let parsedURL;
        try {
          parsedURL = new URL(url, pageURL);
        } catch {
          failures.push(`${htmlRelativePath} contains an invalid URL in ${attributeName}: ${url}`);
          continue;
        }
        if (parsedURL.protocol !== "http:" && parsedURL.protocol !== "https:") {
          continue;
        }
        if (parsedURL.origin !== testOrigin) {
          continue;
        }
        if (!parsedURL.pathname.startsWith(basePath)) {
          failures.push(`${htmlRelativePath} escapes the project base path: ${url}`);
          continue;
        }

        let relativeURL;
        try {
          relativeURL = decodeURIComponent(parsedURL.pathname.slice(basePath.length));
        } catch {
          failures.push(`${htmlRelativePath} contains malformed URL escaping: ${url}`);
          continue;
        }
        const target = relativeURL === ""
          ? path.join(destination, "index.html")
          : relativeURL.endsWith("/")
            ? path.join(destination, relativeURL, "index.html")
            : path.join(destination, relativeURL);
        referencedFiles.add(target);
      }
    }
  }

  for (const referencedFile of referencedFiles) {
    try {
      await access(referencedFile);
    } catch {
      failures.push(`Generated page references a missing local file: ${path.relative(destination, referencedFile)}`);
    }
  }

  const home = await readFile(path.join(destination, "index.html"), "utf8");

  const mainCount = (home.match(/<main\b/gi) ?? []).length;
  const headingCount = (home.match(/<h1\b/gi) ?? []).length;
  if (mainCount !== 1) {
    failures.push(`Homepage should contain exactly one main element; found ${mainCount}.`);
  }
  if (headingCount !== 1) {
    failures.push(`Homepage should contain exactly one h1 element; found ${headingCount}.`);
  }

  for (const sectionID of ["mission", "platform-title", "history-title", "galleries-title", "cta-title"]) {
    const idPattern = new RegExp(`id=(?:["']${sectionID}["']|${sectionID})(?:\\s|>)`, "i");
    if (!idPattern.test(home)) {
      failures.push(`Homepage is missing expected section marker: ${sectionID}`);
    }
  }

  if (!/<img\b[^>]*\bsrcset=/i.test(home) || !/<img\b[^>]*\bfetchpriority=high/i.test(home)) {
    failures.push("Homepage hero is missing its responsive srcset or high fetch priority.");
  }

  for (const expectedPath of ["makerfaire/", "orbitus/", "contact/", "images/site-logo.svg"]) {
    if (!home.includes(`${basePath}${expectedPath}`)) {
      failures.push(`Homepage is missing subpath-safe URL: ${basePath}${expectedPath}`);
    }
  }

  const qr3dFile = path.join(destination, "QR3D", "index.html");
  let qr3d = "";
  try {
    qr3d = await readFile(qr3dFile, "utf8");
  } catch {
    failures.push("The case-sensitive QR landing route QR3D/index.html was not generated.");
  }

  if (qr3d !== "") {
    const qrMainCount = (qr3d.match(/<main\b/gi) ?? []).length;
    const qrHeadingCount = (qr3d.match(/<h1\b/gi) ?? []).length;
    if (qrMainCount !== 1) {
      failures.push(`QR3D should contain exactly one main element; found ${qrMainCount}.`);
    }
    if (qrHeadingCount !== 1) {
      failures.push(`QR3D should contain exactly one h1 element; found ${qrHeadingCount}.`);
    }
    const primaryLink = qr3d.match(/<a\b(?=[^>]*\bdata-qr3d-primary\b)[^>]*>/i)?.[0];
    if (!primaryLink) {
      failures.push("QR3D is missing its primary main-site link.");
    } else {
      const primaryHref = attributeValue(primaryLink, "href");
      try {
        const primaryURL = new URL(primaryHref ?? "", testOrigin);
        if (primaryURL.origin !== testOrigin || primaryURL.pathname !== basePath) {
          failures.push(`QR3D primary link should target ${basePath}; found ${primaryHref ?? "no href"}.`);
        }
      } catch {
        failures.push(`QR3D primary link is invalid: ${primaryHref ?? "no href"}.`);
      }
    }
    if (!qr3d.includes(`${basePath}images/Orbitusrobotics_AR3D.png`)) {
      failures.push("QR3D is missing its subpath-safe QR artwork URL.");
    }
    const renderedSocials = [...qr3d.matchAll(
      /\bdata-qr3d-social\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+))/gi,
    )].map((match) => match[1] ?? match[2] ?? match[3] ?? "");
    for (const network of new Set(renderedSocials)) {
      const count = renderedSocials.filter((candidate) => candidate === network).length;
      if (count !== 1) {
        failures.push(`QR3D should render ${network} once; found ${count} links.`);
      }
      if (!configuredSocialURLs.has(network)) {
        failures.push(`QR3D renders disabled or unknown social link: ${network}.`);
      }
    }

    for (const [network, expectedSocialURL] of configuredSocialURLs) {
      const marker = `data-qr3d-social=(?:["']${network}["']|${network}(?=\\s|>))`;
      const socialLink = qr3d.match(new RegExp(`<a\\b(?=[^>]*${marker})[^>]*>`, "i"))?.[0];
      if (!socialLink) {
        failures.push(`QR3D is missing the enabled ${network} social link.`);
        continue;
      }
      const socialHref = attributeValue(socialLink, "href");
      try {
        const socialURL = new URL(socialHref ?? "");
        if (socialURL.href !== expectedSocialURL) {
          failures.push(`QR3D ${network} link should target ${expectedSocialURL}; found ${socialHref ?? "no href"}.`);
        }
      } catch {
        failures.push(`QR3D ${network} link is invalid: ${socialHref ?? "no href"}.`);
      }
    }

    if (/\bid=(?:["']theme-toggle["']|theme-toggle)(?:\s|>)/i.test(qr3d)) {
      failures.push("QR3D should not render a theme toggle for its fixed dark presentation.");
    }
    if (!/<footer\b(?=[^>]*\bdata-qr3d-footer\b)[^>]*>/i.test(qr3d)) {
      failures.push("QR3D is missing its compact landing-page footer.");
    }

    const canonicalTag = qr3d.match(/<link\b[^>]*\brel=(?:"canonical"|'canonical'|canonical)[^>]*>/i)?.[0];
    const canonicalHref = canonicalTag === undefined ? null : attributeValue(canonicalTag, "href");
    const expectedCanonical = `${testOrigin}${basePath}QR3D/`;
    if (canonicalHref !== expectedCanonical) {
      failures.push(`QR3D canonical URL should be ${expectedCanonical}; found ${canonicalHref ?? "none"}.`);
    }
  }

  const cname = (await readFile(path.join(destination, "CNAME"), "utf8")).trim();
  if (cname !== "www.orbitusrobotics.com") {
    failures.push(`Unexpected CNAME value: ${cname}`);
  }

  for (const metadataFile of ["favicon/site.webmanifest", "favicon/browserconfig.xml"]) {
    const metadata = await readFile(path.join(destination, metadataFile), "utf8");
    if (/(["'])\/favicon\//i.test(metadata)) {
      failures.push(`${metadataFile} contains a host-root favicon URL.`);
    }
  }

  for (const activePage of ["makerfaire/index.html", "orbitus/index.html", "contact/index.html"]) {
    const page = await readFile(path.join(destination, activePage), "utf8");
    if (!/aria-current=(?:["']page["']|page)(?:\s|>)/i.test(page)) {
      failures.push(`${activePage} is missing its active navigation state.`);
    }
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
