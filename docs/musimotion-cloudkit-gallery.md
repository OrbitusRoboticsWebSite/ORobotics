# Musimotion public CloudKit gallery

The Musimotion product page can render the newest creator-published
`CommunityExperience` records directly from the public database in
`iCloud.com.orbitusrobotics.Musimotion`.

This is a read-only website integration. It never queries the private or shared
databases and never requests the editable `archive` asset.

## 1. Prepare the production schema

In CloudKit Console, select `iCloud.com.orbitusrobotics.Musimotion` and confirm
the `CommunityExperience` type in the production environment contains the
existing fields:

- `title` — String
- `summary` — String
- `author` — String
- `duration` — Double
- `sceneCount` — Int64
- `modifiedAt` — Date/Time
- `archive` — Asset; used by the app, deliberately not requested by the website

Add these optional website-preview fields before the app begins publishing
previews:

- `preview` — Asset containing a browser-compatible H.264/AAC MP4
- `poster` — Asset containing a JPEG, PNG, or WebP poster
- `previewWatermarked` — Int64; `1` for a free preview and `0` for a clean paid export
- `shareURL` — String containing an HTTPS App Clip or public experience URL
- `aiAssisted` — Int64; `1` when the creator chooses to disclose AI assistance
- `websiteVisible` — Int64; omit or set to `1` to show the record, set to `0` to hide it

Add a queryable index for `recordName` and a sortable index for `modifiedAt`.
Deploy the updated development schema to production before connecting the
website. Keep World access read-only; creation and modification should continue
to require an authenticated app user.

The app should export and attach `preview` and `poster` during the explicit
community-publish flow. It should set `previewWatermarked` from the export
entitlement used for that preview. Do not infer payment status on the website.

## 2. Create the website API token

In CloudKit Console:

1. Select the Musimotion container.
2. Open **API Access**, choose **API Tokens**, and add a token named
   `OrbitusRobotics Website`.
3. Restrict **Allowed Origins** to `https://www.orbitusrobotics.com`.
4. Add `http://localhost:1313` only when local CloudKit testing is needed.
5. Save and copy the API token.

This browser API token is expected to be visible to website visitors. The
Allowed Origins restriction and public-database security roles are the security
boundary. Do not use a server-to-server private key for this static,
read-only gallery.

## 3. Add the token to GitHub Pages

In the `OrbitusRoboticsWebSite/ORobotics` GitHub repository:

1. Open **Settings → Secrets and variables → Actions**.
2. Create the repository secret `MUSIMOTION_CLOUDKIT_API_TOKEN`.
3. Paste the domain-restricted token and save it.
4. Run **Build and deploy Orbitus Robotics** or push to `main`.

The deployment workflow passes the token only to Hugo. Hugo writes the public
token into the Musimotion page at build time. If the token is missing, the page reports that the community gallery is temporarily unavailable.

For a local production-style test:

```sh
MUSIMOTION_CLOUDKIT_API_TOKEN='your-domain-restricted-token' \
MUSIMOTION_CLOUDKIT_ENVIRONMENT='production' \
npm start
```

Use `development` only while testing a development CloudKit schema.

## 4. What the website requests

The browser posts an unfiltered `CommunityExperience` query to the production
public database, sorts it by `modifiedAt`, and requests at most 60 records. It
uses only these desired keys:

`title`, `summary`, `author`, `duration`, `sceneCount`, `modifiedAt`, `preview`,
`poster`, `previewWatermarked`, `shareURL`, `aiAssisted`, and `websiteVisible`.

The gallery displays up to nine visible records from the response. **Open public page** produces an HTTPS URL of the form
`/products/musimotion/?creation=<record-name>#community`. A direct visit sends a separate query limited to one `CommunityExperience`
whose system `recordName` equals the selected reference. This works for posts outside the latest nine. Both views use the same
public fields and visibility check. The website visibility flag controls these views only. CloudKit record permissions govern access to the underlying public data. Unlisted App Clips and private collaborations use independent share flows.

The browser starts a movie only when the visitor presses Play. Older records without a movie are labeled **Movie preview unavailable**.
A hidden or missing creation has a return link to the gallery. An unreachable CloudKit service has a distinct retry message.
Run `node --test tests/musimotion-community.test.mjs` for the record-selection, privacy, rendering and recovery cases. The
[illustrated public sharing guide](https://www.orbitusrobotics.com/products/musimotion/community-sharing/) shows the visitor workflow.

Apple references:

- [Composing CloudKit Web Service requests](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html)
- [Fetching records using a query](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/QueryingRecords.html)
- [Public CloudKit database behavior](https://developer.apple.com/documentation/cloudkit/ckdatabase/scope/public)
