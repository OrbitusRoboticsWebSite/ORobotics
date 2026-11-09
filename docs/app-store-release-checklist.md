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

## SignalAtlas 1.0 launch preparation — November 7, 2026

SignalAtlas for Mac (`com.raramayo.SignalAtlas`, App Store ID `6832020243`) and the separate public-API SignalAtlas GPS companion (`com.raramayo.SignalAtlasGPS`, App Store ID `6832017704`) have production App Store builds 1.0.0 (10) uploaded and processed as VALID. The Mac price is $4.99 US; the companion is free. Both use automatic release after Apple approval. This entry supersedes the earlier prototype-only description for the new public targets; the private research prototype remains separate.

At this publication checkpoint, the versions remain in preparation and are not publicly available in the US lookup. The catalog and product page say build uploaded / submission in preparation and intentionally omit unverified customer download links. The product, support section, privacy policy, actual app screenshots, generated icon, HTML manual and 14-page PDF are included. No separately hosted executable is required: both apps are distributed through Apple.

Validation: full `npm test` passed, including eight-product catalog, gallery, white-paper and subpath checks. Native Chrome inspection confirmed the desktop layout and a 390 × 844 responsive layout, and the manual button opened the HTML manual with the correct PDF URL. The manual PDF is 2,250,758 bytes, SHA-256 `3126f5593e8ba1ee33cc03e35937ff165c2fe86ab570abb3d8238705ea53493d`. Apple privacy disclosures are published as Data Not Collected for both apps; the policy explains local location transfer, storage, exports and Apple's map services.

### Submission and public verification — November 7, 2026, 08:45 PST

Apple accepted the final submission requests for both version 1.0.0 (10) releases. Both version records and review submissions report `WAITING_FOR_REVIEW`, with automatic release after approval. Mac submitted at 16:45:42 UTC; GPS submitted at 16:45:45 UTC. Mac uses two fully processed screenshots (Overview and Radar); the companion uses the required iPhone and iPad screenshots. Draft image uploads still processing were removed while their source files remain in the app repository and the History image remains on the website.

Initial publication commit `8df10508c7f97137e217fe06e2a144b017cc47f2` deployed successfully in [GitHub Pages run 42392552159](https://github.com/OrbitusRoboticsWebSite/ORobotics/actions/runs/42392552159), completed at 16:43:26 UTC. The canonical product, HTML manual, privacy policy and PDF URLs returned HTTP 200. The downloaded PDF matched the SHA-256 above. This follow-up changes the catalog and page labels to submitted / waiting for review. Public App Store availability is still pending; no customer download links are advertised. The app repository's release receipt records the final website deployment.


## ROBCodeAgent reviewed calls - 2026-11-08

Version 0.1.3 (1022), source `d39a6324cdbcc569aee7df870632a689b5b1b2bd`, adds editable on-device dictation, the resettable ten-second countdown, held corrections, synthesized updates with Pause/Resume/Replay, and command-line script channels. The startup fix preserves saved tabs when a script event arrives before the complete session list. Both platform builds, 69 core tests, the script CLI round trip, and targeted iPhone/iPad call UI tests passed. CI initially hit the existing automatic-refresh test's 60 ms timing deadline; an unchanged rerun passed. The exact source passed [Build and test](https://github.com/RudyAramayo/ROBCodex/actions/runs/42560715282) and [Upload App Store build](https://github.com/RudyAramayo/ROBCodex/actions/runs/42560715225).

App Store Connect version `3eaeb309-9d1f-4b40-a18a-16c6a818e388` has processed build `fb080a35-6ebc-4ea6-81f8-0231a55f8e06` (1022) attached. Replacement submission `05df43d5-11a8-435f-a3c4-c646e81f5e29` and the version both report `WAITING_FOR_REVIEW`. Build 1021 was withdrawn by the developer after live validation exposed the startup issue and replaced by 1022 before website publication. The public US storefront still offers 0.1.2 for $4.99. The product catalog preserves that public version and separately labels 0.1.3 as pending Apple review. Six screenshots per device family are complete in App Store Connect; Voice, workspace, and landscape captures were refreshed from the actual offline UI.

The matching universal Mac bridge is Developer ID signed, accepted by Apple notarization, stapled, and accepted by Gatekeeper. Public archive: `/downloads/robcodex/ROBCodeAgentBridge-macOS-universal-0.1.3.zip`, 5,105,431 bytes, SHA-256 `32b2e73569a2c9f9606fac3d306e96d7469d065fd732c6dc6364d69739dc4505`. Legacy-name aliases contain the same bytes. The app repository release record captures final website deployment and public-download verification.

The site-size budget is 425 MiB for this release, accommodating the three matching bridge ZIPs while preserving earlier downloads. The complete rebuilt site is 417.4 MiB; per-media validation remains unchanged.
