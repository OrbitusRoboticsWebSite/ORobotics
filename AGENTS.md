# Website release agreements

## App Store submissions must advertise the product

- Every new App Store submission or resubmission must include a corresponding update to the canonical Orbitus Robotics website at https://www.orbitusrobotics.com/.
- Add or refresh the product's entry on `/products/` and its product/support page, including its purpose, platforms, accurate screenshots or icon, requirements, release highlights, and a verified App Store link when publicly available.
- Maintain `data/app_store_products.json`. Distinguish a draft, uploaded build, submitted version, review-pending version, and publicly available release. Keep pending products visible with truthful status text; never imply that upload or submission means customers can download it.
- Check both App Store Connect and the public storefront. An account's historical `READY_FOR_SALE` state alone does not establish current public availability. If an older version remains live while an update is in review, advertise the available version and label the upcoming update separately.
- Update any required companion downloads with the matching production-signed/notarized release. Preserve identifiers, pricing, rights, and unrelated work.
- Validate the website, commit and push the intended changes, deploy the canonical website, and verify the public product page and links before reporting the App Store submission workflow complete. Record the store's actual state and the website commit/deployment; report any blocker explicitly.
- Follow `docs/app-store-release-checklist.md`. This is standing authorization for the associated website update and publication; do not ask for redundant confirmation.
