import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setImmediate } from "node:timers/promises";
import { runInNewContext } from "node:vm";

const script = await readFile(new URL("../assets/js/musimotion-community.js", import.meta.url), "utf8");
const galleryURL = "https://example.test/prefix/products/musimotion/";

class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.hidden = false;
    this.attributes = {};
    this.listeners = {};
    this.classList = new Set();
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  after(node) { this.next = node; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { this.listeners[name] = listener; }
  descendants(tag) {
    return this.children.flatMap(child => [...(child.tag === tag ? [child] : []), ...child.descendants(tag)]);
  }
}

function record(name, fields = {}) {
  return {
    recordName: name, recordType: "CommunityExperience",
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value }])),
  };
}

async function render({ query = "", records = [], response, statusCode = 200, token = "test" } = {}) {
  const grid = new Element("div");
  grid.hidden = true;
  const fallback = new Element("div");
  const status = new Element("p");
  const calls = [];
  const document = {
    getElementById: () => ({ textContent: JSON.stringify({ apiToken: token, container: "iCloud.test" }) }),
    querySelector: (selector) => ({ "[data-musimotion-community-grid]": grid,
      "[data-musimotion-community-fallback]": fallback, "[data-musimotion-community-status]": status })[selector],
    createElement: tag => new Element(tag),
  };
  const fetch = async (url, options) => {
    calls.push({ url, request: JSON.parse(options.body), options });
    return { ok: statusCode === 200, json: async () => response ?? { records } };
  };
  runInNewContext(script, { window: { location: new URL(galleryURL + query) }, document, URL, fetch });
  await setImmediate();
  return { grid, status, fallback, calls };
}

test("latest public cards sort, filter, link through the deployment prefix and omit the editable archive", async () => {
  const entries = Array.from({ length: 11 }, (_, i) => record(`public-${i}`, { title: `Title ${i}`, modifiedAt: i + 1 }));
  entries.push(record("hidden", { websiteVisible: "0", modifiedAt: 999 }));
  const { grid, calls } = await render({ records: entries });
  assert.equal(calls.length, 1);
  const { request, url, options } = calls[0];
  assert.equal(url.pathname, "/database/1/iCloud.test/production/public/records/query");
  assert.equal(options.credentials, "omit");
  assert.equal(request.query.recordType, "CommunityExperience");
  assert.deepEqual(request.query.filterBy, []);
  assert.equal(request.desiredKeys.includes("archive"), false);
  assert.equal(request.desiredKeys.includes("sourceRecordName"), false);
  assert.equal(grid.children.length, 9);
  assert.equal(grid.descendants("h3")[0].textContent, "Title 10");
  assert.equal(grid.descendants("a")[0].href, galleryURL + "?creation=public-10#community");
});

test("permalink fetches its specific published record and renders video with explicit playback controls", async () => {
  const title = "<b>Real text</b>";
  const { grid, calls, fallback } = await render({ query: "?creation=public-deep#community", records: [
    record("public-deep", { title, preview: { downloadURL: "https://example.test/media.mp4" }, previewWatermarked: 0 }),
  ] });
  const { request } = calls[0];
  assert.equal(request.resultsLimit, 1);
  assert.equal(request.query.recordType, "CommunityExperience");
  assert.deepEqual(request.query.filterBy, [{ systemFieldName: "recordName", comparator: "EQUALS",
    fieldValue: { type: "REFERENCE", value: { recordName: "public-deep" } } }]);
  assert.equal(fallback.hidden, true);
  assert.equal(grid.hidden, false);
  assert.equal(grid.descendants("h3")[0].textContent, title);
  assert.equal(grid.descendants("video")[0].controls, true);
  assert.equal(grid.descendants("video")[0].autoplay, undefined);
  assert.equal(grid.descendants("source")[0].src, "https://example.test/media.mp4");
  assert.equal(grid.next.href, galleryURL + "#community");
  grid.descendants("source")[0].listeners.error();
  assert.equal(grid.descendants("video").length, 0);
  assert.ok(grid.descendants("p").some(element => element.textContent.includes("Reload the page")));
});

test("unavailable, hidden, mismatched, deleted and unlisted items produce identical direct-link recovery", async () => {
  for (const records of [[], [record("target", { websiteVisible: 0 })],
    [record("other")], [{ ...record("target"), deleted: true }], [{ ...record("target"), recordType: "SharedClip" }]]) {
    const { grid, status, fallback } = await render({ query: "?creation=target", records });
    assert.equal(grid.hidden, true);
    assert.equal(grid.children.length, 0);
    assert.equal(fallback.hidden, true);
    assert.match(status.textContent, /removed or hidden/);
    assert.equal(grid.next.href, galleryURL + "#community");
  }
});

test("invalid links, unconfigured galleries, service errors and metadata-only cards have distinct recovery", async () => {
  for (const query of ["?creation=", "?creation=first&creation=second", "?creation=x%2Fy"]) {
    const { calls, status } = await render({ query });
    assert.equal(calls.length, 0);
    assert.match(status.textContent, /invalid/);
  }
  for (const options of [{ token: "" }, { response: { serverErrorCode: "SERVICE_UNAVAILABLE" } }, { statusCode: 503 }]) {
    const { grid, status, fallback } = await render(options);
    assert.equal(grid.hidden, true);
    assert.equal(fallback.hidden, true);
    assert.match(status.textContent, /temporarily unavailable/);
  }
  const { grid } = await render({ records: [record("legacy", {
    title: "Legacy", preview: { downloadURL: "http://example.test/unsafe" }, shareURL: "javascript:alert(1)",
  })] });
  assert.ok(grid.descendants("span").some(node => node.textContent === "Movie preview unavailable"));
  assert.equal(grid.descendants("video").length, 0);
  assert.deepEqual(grid.descendants("a").map(node => node.href), [galleryURL + "?creation=legacy#community"]);
});
