# App Store and website release checklist

An App Store submission includes its company website advertisement. This applies to new products, updates, resubmissions, and companion releases.

User-facing feature changes also require documentation, guided screenshots and website publication, including installed development previews before any store submission. Follow `docs/feature-documentation-checklist.txt` and `AGENTS.md`; preserve accurate release status.

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
| Musimotion Pro | git.musimotion | 750098892 | macOS 1.0.0 build 7 approved, pending developer release; iOS 1.0.0 rejected | November 19 check: approved is not public; advertise visionOS as development preview |
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

## Musimotion spatial preview documentation — November 19, 2026

Mac 1.0.0 build 7 and all four related purchase/subscription review items were approved at the November 19 check. The manual release action has not been performed, and the US Mac storefront lookup had no public result. China compliance remains pending. The changes described here are a development preview, not the approved binary or a new App Store submission.

Guide edition 1.2 at `/products/musimotion/vision-guide/` matches the app's
`docs/VISIONOS_USER_GUIDE.md`. It covers legacy 2D reading, solid 3D volume
creation, XYZ keyframes, camera views on Mac/iPad, bounded Vision Pro windows,
full immersion, original artwork controls, Sumi paper and solid depth ink,
saving/reopening and camera movie export. Fifteen actual UI captures show safe
synthetic data, with source tests, recording offsets and hashes in the public
provenance file. Images open at full resolution. The generated banner package
and SHA-256 manifest are downloadable; it is a project fixture, not an installer.
A separate physical-headset acceptance checklist records all device cases as
not run.

Mac core regression: 118 passed; the optional Mac UI runner was blocked by
local macOS automation authentication. Manual Computer Use verified the latest
Mac build's saved project and 2D/3D switching. iPad: 23 passed, with a separate
passing capture/recovery rerun. The full visionOS run passed 36, skipped one
direct gesture that the simulator cannot synthesize, and hit one keyboard-focus
failure. The field-label focus fix then passed both complete banner authoring
repetitions, including save/reopen and 3D entry; the other 36 passing checks
remain the preceding full-run evidence. Exact runs are in the app's test report. No physical comfort, hand tracking, sustained performance or live
sharing claim is made. Native video effects, spatial emitters and collision
physics retain documented gaps.

The catalog, product page, guide and support/discovery links use the same
preview status. Desktop and 390 × 844 mobile inspection confirmed readable
instructions, the depth table, product layout and full-size screenshot links.
`npm test` passed the existing suites, production build, gallery budget, eight
product records, white-paper hashes and 91 subpath HTML files. Deployment and
public-byte verification are retained in the private release receipt.
Documentation publication does not release or submit the app.

Application implementation and guide source: `690e345dc8d2945e0c6973b2f010d4bfe0886719` (pushed to
`RudyAramayo/Musimotion` main). Fifteen screenshot hashes and the 1,088-byte
banner archive are verified against their manifests. Banner archive SHA-256:
`7e3bf40e2a740559a5e4298950b869bc3d4ea0e18e77d5e2ff2a7e27cc2d2cbb`.

### Birthday effects preview, guide 1.3

The November 19 development guide adds the birthday scene, balloon collisions,
confetti, fireworks, Reduce Motion and the difference between live viewer contact
and camera playback. The product page and catalog label this as development work.
This documentation update leaves the approved Mac binary and release status unchanged.

### Rhythm Studio development preview, guide 1.4

The product page and guided walkthrough describe the editable rhythm template,
local song analysis, hand-tracked play and panorama. Reference Mac and simulator
captures identify the build and host in the image provenance. The physical
headset protocol covers tracking recovery, beat timing and comfort. The App
Store release record is unchanged by this documentation publication.

The guide includes nine new Mac and simulator captures, the editable Orbit Pulse
project (585,553 bytes), and a user-initiated 18-second camera movie with music
(1,853,830 bytes). The downloadable manifest records the SHA-256 for both media
artifacts. The product preview and illustrated guide were visually inspected in
Chrome on desktop and at a 390 × 844 mobile viewport.

Validation passed 127 website tests, the eight-product catalog check, the gallery
and white-paper checks, and subpath validation. The local build validated 43
linked guide and product resources.

### Droid Arena and Music Studio, guide 1.5

The November 19 development guide adds ten Mac, iPad simulator and Vision Pro
simulator captures. The guide shows how to create an arena, follow the droid
waves, draw or raise the shield, and recover when hands leave view. Music
Studio instructions cover on-device model selection, auditioning a variation,
adding a clip and scoring a whole presentation. The device protocol includes
seated reach, hand occlusion, guard opening cues and perceived audio timing.
Physical headset acceptance remains open.

The sample project contains Orbital Pulse, an eight-bar, 132 BPM techno cue
composed by Apple Foundation Models. The 42-second camera movie has one stereo
soundtrack spanning all three waves. Warehouse Techno is a separate four-bar
WAV that readers can audition on the page. The edition's downloadable manifest
identifies the two takes and records all three file sizes and checksums.
The product preview and guide anchors were visually checked in Chrome on
desktop and at 390 × 844. Each guide image reserves its measured dimensions
so the selected step stays in view as the screenshots load.

The catalog identifies both features as development work. The Mac 1.0.0
build 7 approval and its separate manual release are recorded above.

Source and test record are on Musimotion main at
`3cc7731a111c8cd2fd463931473362ca7581b038`. The three sample files total
9,788,306 bytes. The full site measures 448.2 MiB with a 450 MiB aggregate
budget. Individual media limits continue to apply.

The 127 site tests passed, along with the eight-product catalog, gallery and
white-paper checks and subpath rendering of 91 HTML files. Local publication
checks verified the four public routes and their 53 linked resources,
including the natural dimensions and checksums of all 41 guide screenshots.


## November 19, 2026 · Musimotion object editing and scene templates

Guide 1.6 documents the development build for Mac, iPad and Vision Pro. The
Objects list exposes authored content, including items outside the current
playhead time. The Mac walkthrough shows selecting overlapping artwork,
inspecting timing, copying an object and using the timeline transport.
The Templates sheet offers a separate library document or an editable scene
import. Twelve new annotated captures bring the guide to 53 native Mac and
simulator images. The Mac run that added an arrow, clicked it in the 3D camera
and pasted a copy passed all 152 selected tests. The four spatial template
workflows passed in the 73-test Vision Pro simulator run.
Website validation covered 127 tests, the eight-product catalog, and 69 guide,
image and sample resources. The production build measured 448.5 MiB.
See the [illustrated guide](../content/musimotion-vision-guide.md) and its
[capture provenance](../static/images/musimotion/visionos/provenance.json).

## November 19, 2026 · Rhythm and Music Studio ensembles

Guide 1.7 adds three native Mac captures of Rhythm Studio and Music Studio.
The listening comparison provides House with Studio Band, Ambient with
Chamber and Retro 8-bit. Each eight-second, 120 BPM recording has a labeled
player and download. The three lossless FLACs total 1,410,871 bytes.
Every decoded sample matches the original, two-channel, 32 kHz WAV from the
Mac development engine. The [recording manifest](../static/downloads/musimotion/visionos/music-ensemble-examples.json)
includes the players, seed, tempo and checksums for each recording.

The 127 website tests passed. The build validated eight catalog products, 91
HTML pages under a project subpath, and 76 linked guide, download and product
resources. The site measured 449.96 MiB. The catalog presents these features
as a development preview. The original Orbit Pulse sample remains available
for earlier projects.

## November 19, 2026 · Sumi ink development preview

Guide 1.8 shows Water and Ink Load, the four Sumi nibs and a native Mac canvas. The product page features an original 65-stroke bamboo study rendered by Musimotion. The [painting lesson](https://www.orbitusrobotics.com/products/musimotion/vision-guide/#5-paint-save-and-replay-sumi-ink) includes the editable study and its four-second H.264 export. These assets document the development editor. The Mac App Store submission retains its separate release state.

## November 20, 2026 · Musimotion editor controls development preview

The [editor controls walkthrough](../content/musimotion-editor-controls.md) covers selecting and moving an object, turning the original four-piece menu, switching between object and celebration effects, and opening the tracks from the far-right transport icon. The guide identifies the development build and records [screenshot provenance](../static/images/musimotion/visionos/editor-controls/provenance.json) for its demonstration scenes.

## November 20, 2026 · Musimotion Pro for Vision Pro

- Apple’s production CloudKit history records six additive record types at 4:16 p.m. Pacific. A signed production client received a share URL, resolved it to the private root, saved an owner edit and retrieved the matching archive. Anonymous direct lookup returned no private root. Second-account acceptance remains a device test.
- The existing universal app identifier has Apple Music enabled. A signed MusicKit client retrieved all three catalog selections. Full catalog playback requires a subscriber account in a supported storefront.
- [Guide 2.0](../content/musimotion-vision-guide.md) documents the 32 spatial music videos, selection, timing and Apple Music controls. The [capture manifest](../static/images/musimotion/visionos/music-videos/provenance.json) identifies the synthetic presentation, original screenshot hashes and display crops.
- The 20.567-second 4K App Preview uses two native simulator recordings and the original Chroma Nova score. Apple marked the upload complete with no errors and finished video transcoding. The first visionOS release was still in preparation at that point. Its public file has 4,991,912 bytes and SHA-256 `110182e518816d92af4d9fadccc5947a1ba5df4c1326dda16b88b5823b40ba3c`. The [source manifest](../static/downloads/musimotion/visionos/spatial-showcase-provenance.json) also covers the 23-second silent movie-wall tutorial.
- The [film catalog](../content/musimotion-robot-films.md) reuses the 19 complete workshop and Maker Faire movies at their original public URLs. Each file matched its source hash. Desktop and phone-width Chromium decoded frames, played, paused and sought in each film. The site size allowance grew by 8 MiB to accommodate the showcase, the two walkthrough recordings and their guided screenshots.
- The first guide deployment, commit `d3bee8a3b482c5ce56400b8e51661a8d1a21fdcf`, passed [Pages run 44846593797](https://github.com/OrbitusRoboticsWebSite/ORobotics/actions/runs/44846593797). Seven live pages and 18 asset hashes were verified, including both films and the companion ZIP.
- The matching Mac preview passed a save, reopen and scrub test with eight recorded move/scale keys. visionOS simulator pointer interaction recorded six keys on the selected object. Seventeen iPad simulator checks passed without skips, including full-film download and reopening, film walls, train authoring, audio sync, canvas modes and ink.
- At 5:00:26 p.m. Pacific on November 20, App Store Connect recorded `WAITING_FOR_REVIEW` for visionOS 1.0.0 build 10, version `5f5ef2c9-a0c4-4d17-90d1-0d7caf4f9794`, review submission `563e2ed9-bee4-44c5-9b3b-be969ac2568a`. Mac 1.0.0 build 7 remains approved pending manual release. Apple accepted six screenshots and two fully transcoded 4K previews. The submitted version is set to release automatically after approval.

## November 20, 2026 · Musimotion model studio and native movies

- The model guide uses seven direct visionOS 26.5 simulator screenshots and native Mac captures of the imported rig. It covers the 3D Models gallery, file and folder import, view keys, URDF joint keys, the bounded volume, export progress and the completed movie player.
- The example URDF ZIP contains 12 links, 11 independently animated joints and 41 OBJ meshes. Its 100,998 bytes match SHA-256 `cdb65cc4815829ab4291f198a4c3753783af234c09d092d788114cdb49d3951c`. Importing the extracted folder produced the same robot as the bundled Joint Lab template.
- The three ROB movies, Robot Panorama Wall and Beat Rail Express are complete 1280 × 720 MP4s from Musimotion’s native exporter. The five files total 51,046,633 bytes, contain stereo AAC audio and have 2,520 frames at 30 fps. The two film and railway sequences have respectively 840 and 450 distinct sampled frames. Dimensions, timestamps, hashes and frame counts are recorded in [the media manifest](https://www.orbitusrobotics.com/downloads/musimotion/visionos/native-movies.json).
- The complete 19-film library retains its source files and checksums. The first download scene now uses the indoor and outdoor Maker Faire films and workshop chassis turn. The next five mix the original 2019 workshop films with recycling and pouring footage.
- The production Hugo build measured 504.8 MiB. The site size allowance rose from 458 to 505 MiB for the original native movie bytes and guide images. All 131 website tests passed, along with eight App Store product checks, five white-paper editions and 98 subpath routes.
- The final native Mac run passed 29 of 29 tests, including the full-film network integration. Fifteen iPad simulator cases passed. The visionOS simulator opened and edited the model, entered the volume and full immersion, and played the result of a real video export. Both desktop and phone-width browsers played and sought all five scored movies and each of the 19 source films.
- At 6:02 p.m. Pacific on November 20, App Store Connect confirmed the withdrawal of visionOS build 10 and showed build 11 as validated and selected. The guide was prepared while a replacement build incorporating relocated URDF mesh recovery was being checked.
- The illustrated guide and native movies were published in `ffb2e96`. [Pages run 44854728137](https://github.com/OrbitusRoboticsWebSite/ORobotics/actions/runs/44854728137) succeeded. Seven live routes, all 28 changed assets and byte seeking on all 19 complete source films were verified on the canonical site.
- The App Store Connect receipt for build 12 records 6:29:02 PM Pacific on November 20 and `WAITING_FOR_REVIEW` for review submission `51e05e2a-a3cf-41f5-9374-4b8a7df1b9f7`. Vision Pro 1.0.0 includes the corrected relocated mesh import, seven screenshots and three fully processed 4K App Store previews. Each Store preview opens with 1.2 seconds of actual visionOS UI, followed by the picture and soundtrack from the native presentation export. Automatic release is configured after approval. Mac 1.0.0 build 7 remains approved pending manual release.

## Musimotion Pro public release and 1.0.1 submissions — November 26, 2026

Apple accepted the manual release of Mac 1.0.0 build 7. It is available alongside native visionOS 1.0.0 build 12. The U.S. [Mac listing](https://apps.apple.com/us/app/musimotion-pro/id750098892?mt=12&platform=mac) names macOS 15.0 or later and the [Apple Vision listing](https://apps.apple.com/us/app/musimotion-pro/id750098892?platform=vision) names visionOS 2.0 or later. The U.S. storefront displays the free app, $29.99 permanent Pro Export purchase, and monthly ($5.99) and yearly ($49.99) Studio subscriptions. The yearly plan has a two-week introductory trial for eligible U.S. subscribers. Each active purchase has 175 configured territories. The iOS 1.0.0 build 5 submission remains rejected.

Both 1.0.1 releases were built from app commit `03f13c20986fab4b4603da6c5355500502e0823a`. The Mac update adds editable presentation templates, animated 3D models and scored movie export. The native visionOS update adds Chill House, Rock and Classical Piano arrangements to Music Studio.

| Platform | Build | Submitted (UTC) | Review ID | App Store Connect response |
| --- | --- | --- | --- | --- |
| macOS | 8 | 2026-11-26T23:01:14.546Z | `b817f2a6-72af-4400-a288-b2324865747a` | `WAITING_FOR_REVIEW` |
| visionOS | 13 | 2026-11-26T23:00:30.65Z | `1f35d036-628b-4b5c-becb-941e2b84ea41` | `WAITING_FOR_REVIEW` |

Both updates are set to release automatically after approval. The public product page and catalog distinguish these submissions from version 1.0.0. Both platforms distribute directly through Apple.
