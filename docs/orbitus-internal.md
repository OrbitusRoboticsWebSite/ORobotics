# Orbitus Internal

Employee portal: `https://www.orbitusrobotics.com/internal/`.

The static website contains only the interface and connection configuration.
All company articles, deliverable details, private document titles and document
bytes live in role-protected CloudKit records. Never put real content, upload
packages, staff names, account IDs, email addresses or credentials in this
repository. The portal is not linked from the public navigation or sitemap.
`noindex` is a crawler preference, not an access control.

## Identity and storage

Use the dedicated container `iCloud.orbitusrobotics.Internal`. Do not reuse the
fleet, education or public-gallery container. Its **public database scope is
shared between approved employees**, but the record permissions deny World,
Authenticated and Creator access to every internal content type. The scope
name does not mean anonymous users can read it. Per-user private databases
would not provide a common company library.

| Record type | InternalEmployee | InternalAdmin |
| --- | --- | --- |
| InternalCatalog | Read | Create/read/write |
| InternalDocumentChunk | Read | Create/read/write |
| InternalAdminGate | None | Create/read/write |
| InternalStaffRoster | None | Create/read/write |

Employee sign-in is through Apple's CloudKit JS. Signing in does not enroll a
user. An administrator assigns a role to a verified CloudKit user record in
CloudKit Console. Never auto-approve the first visitor or match by display name.
Employees do not receive developer-team membership, server keys or fleet roles.

Files up to 20 MiB are stored in 192 KiB binary chunks, encoded as strings in
protected records. This avoids placing PDFs in public website assets or exposing
bearer-only asset download URLs. Each request still needs CloudKit authorization.
The browser checks chunk identity, length and the final SHA-256 before preparing
a download. Files intentionally downloaded by an employee cannot be remotely
revoked; revocation prevents future retrieval through CloudKit.

Content is kept in page memory. No localStorage, IndexedDB or service worker is
used. Sign-out, page navigation, connection failure or 15 minutes of inactivity
clears the interface and revokes outstanding object URLs. The Lock button clears
the page; Apple's Sign Out button ends the CloudKit session. Access is checked
again every minute while open and before each download. Cached content already
seen by an employee cannot be recalled. The frontend is not the security
boundary: CloudKit record permissions are.

## One-time Apple configuration

1. In CloudKit Console, create **Orbitus Internal** with identifier
   `iCloud.orbitusrobotics.Internal` in the company's developer team.
2. Prefer CloudKit Console for schema deployment and export when a management
   token is not already available. The importer accepts a freshly exported
   production schema with an operator-verified receipt (below). Alternatively,
   save an authorized management token in the local Keychain with
   `xcrun cktool save-token --type management`. Do not paste tokens into chat,
   shell arguments, Git, issue descriptions or screenshots.
3. Validate and import `scripts/internal/schema.ckdb` into the new container's
   development environment. Inspect the role grants and deploy the schema to
   production in CloudKit Console. Never reset or overwrite another container.
4. Create a website API token restricted to `https://www.orbitusrobotics.com`.
   This browser token is necessarily public; it does not grant employee access.
5. Prepare private signing-key material with `node scripts/internal/setup-key.mjs
   /absolute/private/new-directory`. Register **internal-public.pem only** under
   the new container's Server-to-Server Keys. Keep the private key local. Fill in
   the returned key ID, team ID and browser token in the private profile.
6. Verify the owner's actual CloudKit identity, then assign InternalAdmin in
   production. Record that exact user record name as `expectedAdminRecordName` in
   the private profile. A server key inherits its owner's roles; key registration
   alone does not confer access. Distribute the key to no employee or webpage.
7. For each employee, have them sign in after the shell is configured and verify
   the account reference displayed on the denied-access screen against the
   employee's Apple identity. Assign only InternalEmployee. Check read succeeds
   and writes remain denied. Revocation means removing that role in the same
   production environment; removing a name from an editorial roster is not
   revocation.

The schema can be validated/imported with `xcrun cktool validate-schema` and
`import-schema`, using `--team-id`, `--container-id`, `--environment development`
and `--file scripts/internal/schema.ckdb`. Use `--help` for the installed version.

## Prepare and import private content

Keep the editorial catalog and file manifest outside Git. The catalog uses
`schemaVersion: 1`, `title`, `updatedAt`, `documents`, `news`, `work` and
`whitepapers`. The file manifest is an array containing an absolute `path`,
`title`, `filename`, `mime`, `category`, `version`, `date`, `summary` and `status`.
Supported types are PDF, JSON, plain text and ZIP. The preparation command refuses
an output location inside a Git repository and never uploads anything:

```sh
node scripts/internal/prepare-import.mjs \
  --catalog /private/catalog-editorial.json \
  --files /private/files-to-import.json \
  --output /private/private-import.json
```

Publish only after roles are assigned. The importer audits a fresh production
schema from Console or exports it using the Keychain management token, verifies the signing-key
owner, creates synthetic canaries, tests owner read and anonymous denial, then
verifies the local package. It uploads immutable chunks and reads every document
back to verify its digest before changing the catalog. Existing documents are
preserved; concurrent catalog edits fail instead of being overwritten.

```sh
node scripts/internal/publish-private.mjs \
  --profile /private/cloudkit-admin/profile.json \
  --package /private/private-import.json \
  --receipt /private/import-receipt.json
```

To avoid provisioning a developer-team management token, select the exact
container's **Production** environment in CloudKit Console, inspect its roles,
and use **Export Schema**. Save the downloaded bytes privately. After observing
the export, create a private JSON receipt with `schemaVersion: 1`, `container`,
`teamID`, `environment: "production"`, absolute `schemaFile`, `exportedAt` (UTC
ISO timestamp), `sha256` of the downloaded file, and `sourceURL` of the observed
production Console page. Pass `--console-schema-receipt /private/export.json`.
The importer checks the container, team, environment, Apple source URL, digest
and a 30-minute freshness window, then performs the same grant audit and live
access probes. This receipt records **operator-verified Console evidence**, not
a cryptographic Apple attestation; never construct it from the local template
or an unobserved download. The import receipt identifies which method was used.

An optional `--unapproved-token-file /private/test-account-token.txt` runs an
additional live signed-in negative test. It verifies the token belongs to a
different active account before checking denial. Without it, the receipt marks
that live test as **not run**, not passed. Do not obtain or retain another
person's token without their authorization. A second account can also manually
verify denial in the browser before its employee role is assigned.

Synthetic canaries remain for review; the importer does not delete records.
On interruption, repeat the same prepared package: existing identical chunks
are reused and mismatches abort. A fresh package creates a new file edition.
Keep original PDFs and a private backup independently of CloudKit.

After a successful read-back, configure GitHub Actions:

| Type | Name | Value |
| --- | --- | --- |
| Secret | ORBITUS_INTERNAL_API_TOKEN | Origin-restricted browser token |
| Variable | ORBITUS_INTERNAL_ENABLED | true |
| Variable | ORBITUS_INTERNAL_ACCESS_VERIFIED | true after live permission review |

`scripts/configure-internal.mjs` enables production only. The tracked config is
disabled with no token, so missing configuration fails closed. Disabling the
shell does not revoke user roles or previously issued credentials.

## Publishing and maintenance

The administrator Publishing screen uploads and verifies files and imports
editorial catalog updates. Employees cannot publish, even by bypassing the UI,
because CloudKit denies writes. Rendered text uses textContent rather than HTML;
links accept HTTPS only. Catalog imports preserve existing file editions.

Updates should include dates, sources and precise status. Separate code changes,
tests, submissions, store listings and physical validation. An internal journal
entry does not publish a private white paper or authorize external outreach.
No automatic newsletter schedule is installed.

For a new deployment, run the portal tests, site build and existing website
validators. Inspect desktop/mobile login, allowed/denied accounts, search,
downloads, publishing, sign-out and stale-session behavior. Verify published
static bytes contain no private data. Local mock tests do not prove live Apple
permissions or successful sign-in. Record the deployment and import receipts
privately.

## References

- [CloudKit role-based access](https://developer.apple.com/icloud/cloudkit/designing/)
- [CloudKit schema grants](https://developer.apple.com/documentation/cloudkit/integrating-a-text-based-schema-into-your-workflow)
- [CloudKit authentication and server keys](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html)
- [Record size limits](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/PropertyMetrics.html)
- [CloudKit JS sign-in](https://developer.apple.com/documentation/cloudkitjs/cloudkit.container/setupauth)
- [Apple command-line tooling](https://developer.apple.com/icloud/ck-tool/)
