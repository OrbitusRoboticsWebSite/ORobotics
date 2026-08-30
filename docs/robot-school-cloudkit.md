# ROB School CloudKit learner passport and reward

Circuit Quest always stores completed mission indexes in first-party browser
storage. CloudKit is optional: after Apple sign-in, the page merges the local
mission set with a record in the learner's private CloudKit database. Completing
all 80 missions can create one stable public reward claim whose QR code is
verified at ROB's Maker Faire booth.

This is a friendly, client-reported curriculum reward. It is not identity proof,
high-value anti-fraud, or a substitute for a staffed redemption log.

## Existing container and record type

The implementation uses container
`iCloud.com.orbitusrobotics.Musimotion` and reuses the existing
`ROBLeaderboardEntry` record type so production does not need a second schema.
The type must expose these fields:

| Field | CloudKit type | Passport use |
| --- | --- | --- |
| `callSign` | String | Private maker nickname; public reward always uses `ROB MAKER` |
| `score` | Int64 | Private count × 3; reward uses 0 |
| `durationSeconds` | Int64 | 0 |
| `levelsCompleted` | Int64 | Completed count; reward requires 80 |
| `completedAt` | Date/Time | Last private sync or claim creation |
| `platform` | String | `robot-lab-private` or `robot-lab-reward` |
| `gameVersion` | String | Versioned 80-bit mission set or reward code |
| `websiteVisible` | Int64 | 0, keeping these records out of the leaderboard UI |

The private record name is `rob-school-progress-v1`. Because it lives in each
user's private database, identical names do not collide across accounts.

The public reward record name is a SHA-256-derived identifier based on the
CloudKit user record name, container, and curriculum version. The QR contains
only this opaque record name and a short derived code. It does not contain the
nickname, email address, or Apple account identifier.

## Security roles

Keep the public-database roles used by the leaderboard:

- World: read
- Authenticated: create
- Creator: read and write

Private-database records remain visible only to their CloudKit user. Public
World read is required for an unsigned booth browser to fetch a reward by its
opaque record name. Do not grant World create or write.

The public reward is intentionally minimal and direct-fetch only. Booth staff
must verify all of these fields before redemption:

- `levelsCompleted` equals 80
- `platform` equals `robot-lab-reward`
- `gameVersion` equals `school-80-v1:<QR code>`

Staff should then check and update a separate one-time booth redemption log.
This static site does not claim that a CloudKit record has been redeemed,
because allowing an unsigned client to make that authoritative change would be
unsafe.

## Deployment configuration

The GitHub Pages workflow reads:

- Secret `MUSIMOTION_CLOUDKIT_API_TOKEN`
- Variable `ROB_SCHOOL_CLOUDKIT_ENABLED=true`
- Environment `MUSIMOTION_CLOUDKIT_ENVIRONMENT=production`

The API token is embedded in the public web build as required by CloudKit JS;
its allowed origins must include the production Orbitus Robotics domain and any
intentional preview origin. It is not a server secret. Apple sign-in is still
required for private reads/writes and public claim creation.

If the enable variable or token is missing, the lab degrades to a local device
passport. Mission play and progress remain available, while account sync and QR
issuance clearly report that CloudKit is unavailable.

## Release checklist

1. Confirm the `ROBLeaderboardEntry` schema and roles in CloudKit development.
2. Confirm authenticated creation and creator update of public records.
3. Confirm private record create, fetch, merge, and update with two browsers.
4. Complete a test profile, issue a reward, and scan its QR while signed out.
5. Confirm an altered code or record name produces an invalid result.
6. Confirm the QR contains no nickname or account identity.
7. Deploy the schema to production before enabling the GitHub variable.
8. Prepare the booth's one-time redemption log and staff procedure.

References:

- [CloudKit JS](https://developer.apple.com/documentation/cloudkitjs)
- [CloudKit JS authentication](https://developer.apple.com/documentation/cloudkitjs/cloudkit.container/setupauth)
- [CloudKit private database](https://developer.apple.com/documentation/cloudkitjs/cloudkit.container/privateclouddatabase)
- [Designing CloudKit security roles](https://developer.apple.com/icloud/cloudkit/designing/)
