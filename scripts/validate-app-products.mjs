import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(path.join(root, "data/app_store_products.json"), "utf8"));
const hub = await readFile(path.join(root, "public/products/index.html"), "utf8");
const ids = new Set();
const slugs = new Set();
assert.match(catalog.verified_at, /^\d{4}-\d{2}-\d{2}$/);
assert.ok(catalog.products.length, "Product catalog is empty");

for (const app of catalog.products) {
  assert.ok(!ids.has(app.app_id), `Duplicate App Store ID: ${app.app_id}`);
  assert.ok(!slugs.has(app.slug), `Duplicate product slug: ${app.slug}`);
  ids.add(app.app_id);
  slugs.add(app.slug);
  assert.match(app.app_id, /^\d+$/);
  assert.match(app.slug, /^[a-z0-9-]+$/);
  for (const field of ["name", "bundle_id", "source_project", "platforms", "description", "page"]) {
    assert.ok(typeof app[field] === "string" && app[field].trim(), `${app.slug}: missing ${field}`);
  }
  assert.ok(["available", "approved", "submitted", "draft"].includes(app.status), `${app.slug}: invalid status`);
  assert.match(app.page, /^[a-z0-9/-]+\/(?:#[a-z0-9-]+)?$/);
  assert.ok(!app.page.includes(".."));
  const [route, anchor] = app.page.split("#");
  const detail = await readFile(path.join(root, "public", route, "index.html"), "utf8");
  if (anchor) assert.match(detail, new RegExp(`id=["']?${anchor}(?:["'\\s>])`));
  const card = hub.match(new RegExp(`<article\\b[^>]*data-app-id=["']?${app.app_id}["']?[^>]*>[\\s\\S]*?<\\/article>`))?.[0];
  assert.ok(card, `${app.name} is missing from the rendered products page`);
  assert.ok(card.includes(app.name), `${app.name}: card title missing`);
  assert.ok(card.includes(app.page), `${app.name}: product-page link missing`);
  if (app.status === "available") {
    assert.equal(app.store_url, `https://apps.apple.com/app/id${app.app_id}`);
    assert.ok(app.version && app.requirement && app.headline && app.icon);
    await access(path.join(root, "assets", app.icon));
    assert.ok(card.includes(app.store_url), `${app.name}: store link missing from card`);
    assert.ok(detail.includes(app.store_url), `${app.name}: store link missing from detail page`);
    assert.match(card, /<img\b[^>]*\balt(?:=["']{2})?(?=\s|>)/, `${app.name}: icon needs decorative alt text`);
  } else {
    assert.ok(!app.store_url, `${app.name}: do not expose an unverified store URL`);
    assert.ok(!card.includes("apps.apple.com"), `${app.name}: pending card advertises a download`);
  }
}
console.log(`Validated ${catalog.products.length} App Store products, availability labels, product routes, icons, and download links.`);

const filmGroups = JSON.parse(await readFile(path.join(root, "data/musimotion_robot_films.json"), "utf8"));
const films = filmGroups.flatMap(group => group.films);
const filmPage = await readFile(path.join(root, "public/products/musimotion/robot-films/index.html"), "utf8");
assert.equal(new Set(films.map(film => film.src)).size, 19, "Expected 19 distinct source films");
assert.equal(films.length, 19, "Duplicate source film");
for (const film of films) {
  assert.ok(film.title && film.description && film.poster, "Film is missing its label, description or poster");
  assert.match(film.duration, /^\d+:\d{2}$/);
  assert.match(film.src, /^(?:images|videos)\/[\w./-]+\.mp4$/i);
  for (const asset of [film.src, film.poster, film.captions].filter(Boolean)) {
    assert.ok(!asset.split("/").includes(".."));
    assert.ok(filmPage.includes(asset), `Film page is missing ${asset}`);
    await access(path.join(root, "public", asset));
  }
}
console.log(`Validated ${films.length} Musimotion films, original media links, captions and posters.`);

const publicDirectory = path.join(root, "public");
const mediaDirectory = path.join(publicDirectory, "downloads/musimotion/visionos");
const modelGuide = await readFile(path.join(publicDirectory, "products/musimotion/3d-models/index.html"), "utf8");
const volumeGuide = await readFile(path.join(publicDirectory, "products/musimotion/vision-guide/index.html"), "utf8");
const manifest = JSON.parse(await readFile(path.join(mediaDirectory, "native-movies.json"), "utf8"));
assert.equal(new Set(manifest.movies.map(movie => movie.template_id)).size, 5);
for (const movie of manifest.movies) {
  const route = movie.template_id === "beatRailExpress" ? volumeGuide
    : (movie.template_id === "robotPanoramaWall" ? filmPage : modelGuide);
  assert.ok(route.includes(movie.file), `No player for ${movie.title}`);
  assert.ok(route.includes(movie.poster.file), `No poster for ${movie.title}`);
  const movieBytes = await readFile(path.join(mediaDirectory, movie.file));
  assert.equal(movieBytes.byteLength, movie.bytes);
  assert.equal(createHash("sha256").update(movieBytes).digest("hex"), movie.sha256);
  await access(path.join(mediaDirectory, movie.file.replace(/\.mp4$/, ".en.vtt")));
  assert.equal(movie.frames, Math.round(movie.seconds * movie.fps));
  assert.equal(movie.audio.channels, 2);
}
const robotZip = await readFile(path.join(publicDirectory, "downloads/musimotion/models/ROB-Joint-Lab.zip"));
const robotHash = createHash("sha256").update(robotZip).digest("hex");
assert.ok(modelGuide.includes("downloads/musimotion/models/ROB-Joint-Lab.zip") && modelGuide.includes(robotHash));
console.log("Verified the five full native movies, posters, captions and the downloadable ROB joint model.");
