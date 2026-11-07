import assert from "node:assert/strict";
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
  assert.ok(["available", "submitted", "draft"].includes(app.status), `${app.slug}: invalid status`);
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
