# Website release agreements

## White papers must be published on the website

- Every requested Orbitus white paper includes publication on https://www.orbitusrobotics.com/ by default. This is standing authorization; do not ask again unless the user explicitly limits the work to a private draft.
- Publish the final PDF and a full HTML edition under `/whitepapers/`, with home/library discovery links, date, version, sources, evidence boundaries, file size and SHA-256 manifest.
- Render and visually inspect every changed PDF page, validate the website and links, commit and push the intended changes, deploy, and verify the public HTML and downloaded PDF against the final checksum before reporting publication complete.
- Preserve unrelated work and earlier editions. Distinguish proposed functionality, source implementation, tests, live acceptance and public availability. Report any publication blocker explicitly.
- Website publication alone does not authorize contacting an external publisher or submitting a book to a store.

## App Store submissions must advertise the product

- Every new App Store submission or resubmission must include a corresponding update to the canonical Orbitus Robotics website at https://www.orbitusrobotics.com/.
- Add or refresh the product's entry on `/products/` and its product/support page, including its purpose, platforms, accurate screenshots or icon, requirements, release highlights, and a verified App Store link when publicly available.
- Maintain `data/app_store_products.json`. Distinguish a draft, uploaded build, submitted version, review-pending version, and publicly available release. Keep pending products visible with truthful status text; never imply that upload or submission means customers can download it.
- Check both App Store Connect and the public storefront. An account's historical `READY_FOR_SALE` state alone does not establish current public availability. If an older version remains live while an update is in review, advertise the available version and label the upcoming update separately.
- Update any required companion downloads with the matching production-signed/notarized release. Preserve identifiers, pricing, rights, and unrelated work.
- Validate the website, commit and push the intended changes, deploy the canonical website, and verify the public product page and links before reporting the App Store submission workflow complete. Record the store's actual state and the website commit/deployment; report any blocker explicitly.
- Follow `docs/app-store-release-checklist.md`. This is standing authorization for the associated website update and publication; do not ask for redundant confirmation.

## Feature changes include documentation, the website and guided screenshots

- For every user-facing feature, behavior or workflow change, update the relevant user documentation and canonical Orbitus Robotics product/support website as part of the same task. Apply this to installed development features as well as releases; do not wait for an App Store submission. This is standing authorization to publish the associated documentation and website update without redundant confirmation.
- Teach the workflow with plentiful, readable screenshots of the actual UI: show where to start, each meaningful setup/action, the expected result, and important incomplete/error/recovery states. Pair each screenshot with numbered actions, exact control labels, captions and accessible alternative text. Use safe demonstration data and label synthetic fixtures or historical captures; do not publish private inventories, paths, credentials or unrelated user content, or fabricate UI/results.
- Keep the user manual, relevant README/help, product/support pages, discovery links and release notes consistent. Regenerate existing PDF/HTML editions as applicable, record version/date and screenshot provenance, and visually inspect the rendered pages and desktop/mobile website. Preserve prior editions where useful.
- Label implemented, tested, locally installed, preview, submitted and publicly available states accurately. Describe permissions, data sent to models, evidence limits and recovery steps where they affect the user. Never replace a production download with a development build or imply a documentation publication is an app release.
- Validate content, links and artifacts; review the diff; commit and push all intended repository changes; deploy the canonical website and verify the live pages and artifact checksums before reporting completion. Record exact publication evidence and any concrete blocker. Preserve unrelated work and follow the existing book/store publication rules when those editions are actually changed.
