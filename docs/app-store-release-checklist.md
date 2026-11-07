# App Store and website release checklist

An App Store submission includes its company website advertisement. This applies to new products, updates, resubmissions, and companion releases.

1. Identify the product by bundle ID and App Store ID. Read current App Store Connect version states and the public storefront. Keep draft, uploaded, submitted, review-pending, and publicly available states distinct.
2. Add or update `data/app_store_products.json` and the product/support page. Include a clear description, platforms, accurate product imagery, compatibility, requirements, release highlights, support/privacy links, and the public App Store URL when available. Do not expose internal review contact information or credentials.
3. Keep `/products/` complete. Live applications get a store link; upcoming products get an accurate status and a working product-page link. A released older version and a review-pending update must be described separately. Never advertise an App Store variant as having capabilities exclusive to a separately distributed edition.
4. Publish required companion artifacts from the release source with production signing/notarization, checksums, and verified public downloads. Keep the existing identifiers, prices, rights, and unrelated changes intact.
5. Run `npm test`. The build includes `validate:app-products`, which verifies catalog entries, rendered product cards, local routes/assets, and store-link placement. Inspect changed layouts at desktop and phone widths.
6. Review the diff, commit and push, and wait for the canonical GitHub Pages deployment to succeed. Verify the live product index and affected detail pages.
7. Record the actual Apple response, website commit, deployment, and verification time. Report blockers for incomplete channels; a successful upload or Git push does not establish a public release.

## Catalog audit: November 6, 2026

The scan matched Xcode project bundle identifiers across the dev folder against all 17 App Store Connect records. Six app records matched local projects. Apple's US public developer catalog listed four currently available apps. Store states were checked through the authenticated read-only API and public iTunes lookup, not inferred from old submission checklists.

| Product | Local project | App Store ID | Current state | Website action |
| --- | --- | --- | --- | --- |
| ROBCodeAgent | ROBCodex | 6807303425 | iOS 0.1.2 available | Add product card; refresh support-page release status |
| CodeAtlas: 3D Code Map | CodeAtlas | 6807302975 | macOS 1.0 available | Add direct App Store calls to action |
| LingonXRob Plist Editor | LingonXRob | 6807102073 | macOS 1.0.0 available | Add product card and dedicated product page |
| ROB Training | ROBTrainingGames | 6805294621 | iOS 1.0 available | Add product card; replace stale waiting-for-review copy |
| Musimotion Pro | git.musimotion | 750098892 | macOS 1.0.0 waiting for review; iOS 1.0.0 rejected | Advertise as upcoming, without a download claim |
| ROB Training Vision | ROBTrainingGames | 6805295387 | visionOS 1.0 prepare for submission | Label the separate spatial edition as a development preview |

The 11 historical account records had no matching bundle identifiers in local project configuration and did not appear in the US public developer catalog. They were not promoted as available. SignalAtlas explicitly identifies its iPhone edition as a development prototype, not an App Store submission; the robot-control stack remains advertised separately.

Public verification: [ChronixNinja developer catalog](https://apps.apple.com/us/developer/chronixninja/id395514478), [ROBCodeAgent](https://apps.apple.com/app/id6807303425), [CodeAtlas](https://apps.apple.com/app/id6807302975), [LingonXRob Plist Editor](https://apps.apple.com/app/id6807102073), and [ROB Training](https://apps.apple.com/app/id6805294621). Refresh status at every release; this table is a dated audit, not a live service.

The four catalog icons came from those Apple storefront listings. The LingonXRob editor screenshot came from its existing `AppStoreAssets/Screenshots/02-launchd-plist-editor.png` and was inspected before publication. The App Store edition is a file editor and does not manage running launchd jobs.

Validation for this update: all 127 existing tests passed, along with the six-product catalog check, gallery and white-paper validation, and the subpath link check. The catalog and new LingonXRob page were inspected in native Chrome at desktop size and a 390 × 844 responsive viewport; the mobile product link opened the new detail page. The deployment workflow repeats build and link/catalog checks before publishing.

## ROB Viper 0.7 development publication — November 6, 2026

The product page, products index and privacy scope describe local ClamAV/Trivy/YARA-X scanning, reports, heuristic signals and app-open scheduling. Public production installer remains pending; no App Store submission or production download is claimed. Scanner engines are separate installations. The 0.7 source and test receipt are maintained in the private EndpointExecutionMonitor repository; the public page does not expose local scan reports or machine findings. Canonical publication uses this repository’s existing GitHub Pages workflow.
