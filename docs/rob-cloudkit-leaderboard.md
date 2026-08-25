# ROB public CloudKit leaderboard

The browser ROB Training game stores completed campaigns in the public database
of `iCloud.com.orbitusrobotics.Musimotion`, alongside but separate from
Musimotion community records. The website queries only `ROBLeaderboardEntry`
records. Musimotion continues to query only `CommunityExperience` records.

Public leaderboard reads are anonymous. Publishing requires Apple sign-in so
CloudKit can identify the record creator. The website also retains a local top
ten as an offline fallback.

## 1. Create the record type

In CloudKit Console, select `iCloud.com.orbitusrobotics.Musimotion` and create
this public-database type in the development environment:

`ROBLeaderboardEntry`

Add these fields:

- `callSign` — String
- `score` — Int64
- `durationSeconds` — Int64
- `levelsCompleted` — Int64
- `completedAt` — Date/Time
- `platform` — String
- `gameVersion` — String
- `websiteVisible` — Int64; omit or set to `1` to show the entry, set to `0` to
  hide it from the website

Add sortable indexes for `score`, `durationSeconds`, and `completedAt`. Add a
queryable index for `recordName`. The website asks CloudKit for the highest
scores first, uses completion time as the tie breaker, and displays at most 20
entries.

## 2. Configure security roles

For `ROBLeaderboardEntry` only:

- World: Read
- Authenticated: Create
- Creator: Read and Write

Do not expand World or Authenticated write permissions on
`CommunityExperience` or any other Musimotion record type. CloudKit requires an
iCloud account for public-database writes; CloudKit JS presents Apple’s sign-in
and associates the saved record with that authenticated creator.

The website derives a stable, non-reversible record name from the CloudKit user
record name. A normal client therefore updates one public best score per Apple
account instead of adding a new row after every playthrough. The call sign,
score, and campaign duration are still client-reported values; this is a casual
community leaderboard, not a cheat-resistant competition service.

## 3. Validate and deploy the schema

1. Use CloudKit’s development environment while creating the type and indexes.
2. Build the site locally with the website API token and
   `MUSIMOTION_CLOUDKIT_ENVIRONMENT=development`.
3. Complete a test campaign, sign in with Apple, and confirm the record is
   created and subsequently updated only when the player improves the score or
   tie-break time.
4. Confirm anonymous browser sessions can read the board but cannot publish.
5. Deploy the development schema to production in CloudKit Console.
6. In the website repository, create the Actions variable
   `ROB_CLOUDKIT_LEADERBOARD_ENABLED` with the value `true`, then run **Build
   and deploy Orbitus Robotics**.

The existing `OrbitusRobotics Website` API token and
`MUSIMOTION_CLOUDKIT_API_TOKEN` GitHub Actions secret are reused. The token must
allow `https://www.orbitusrobotics.com`; add `http://localhost:1313` only while
performing local CloudKit tests. The API token is expected to be visible in the
browser. Apple sign-in and the record-type security roles are the write-access
boundary. Until the production schema is ready and the enable variable is set,
the deployed ROB page stays in local-only mode instead of presenting a broken
CloudKit board.

## 4. Website behavior

- The public query requests only leaderboard display fields and never user
  identities.
- Call signs are restricted to 12 letters, numbers, spaces, underscores, or
  hyphens and are rendered with `textContent`.
- A completed campaign is saved locally before a CloudKit publish is attempted.
- A CloudKit read or write failure leaves the local leaderboard available and
  exposes no token or server error details.
- Clearing scores on the device never deletes public CloudKit records.
- An administrator can hide an entry by setting `websiteVisible` to `0` or can
  delete it in CloudKit Console.

Apple references:

- [CloudKit JS](https://developer.apple.com/documentation/cloudkitjs)
- [CloudKit JS authentication](https://developer.apple.com/documentation/cloudkitjs/cloudkit.container/setupauth)
- [Saving records with CloudKit JS](https://developer.apple.com/documentation/cloudkitjs/cloudkit.database/saverecords)
- [Designing CloudKit security roles](https://developer.apple.com/icloud/cloudkit/designing/)
