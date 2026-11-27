# Viper Fleet portal and direct CloudKit reporter

Unlisted URL: https://www.orbitusrobotics.com/viper-fleet/

The buildless portal lives under `static/viper-fleet/`, outside Hugo's page
list, navigation, search, RSS and sitemap. Keep it unlisted. `noindex, nofollow,
noarchive` asks crawlers to stay away; anyone who discovers the URL can load
the shell and invented examples. CloudKit authorization protects live records.
Never put private machine reports or signing keys in the website repository.

## Direct reporting

The original direct reporter signs HTTPS JSON and submits it to the public
database of `iCloud.orbitusrobotics.ViperFleet`. The browser reads CloudKit
through Apple-hosted authentication and the custom `FleetAdmin` role.

Keep the Apple server-to-server private key on an operator-controlled server.
Apple's registration form warns that the key gives unrestricted access to the
container's public database. It has no control for restricting a key to a
device, group or record type. A separate key ID permits separate revocation.
Never distribute an Apple private key in a recipient app, ZIP or profile.
[Apple's CloudKit Catalog](https://developer.apple.com/go/?id=cloudkit-catalog)

Reporter source, setup tool, schema, tests and operator instructions remain in
the ROB Viper codebase:
https://github.com/RudyAramayo/EndpointExecutionMonitor/tree/main/ViperLink/Fleet

The public `ViperFleet-Reporter-0.2.0.zip` contains source and documentation only,
with size/SHA-256 in `reporter-manifest.json`. It needs Node.js 22 or later and no
npm packages. It reads only an operator-supplied report; no host inventory,
remote command, automatic schedule or file-transfer service is installed.

## Activation state

The development container, registered key and owner roles have been configured.
Synthetic creation/update/read-back/sorting passed against Apple; anonymous
querying was denied and anonymous lookup hid the existing test record.
Source `config.json` remains disabled with no token. The deployment can enable
a development pilot to verify Apple sign-in. Production and an unrelated
signed-in account require separate checks. The sample button displays five
invented machines across macOS, Windows and Linux.

After verifying schema, owner role and anonymous/unrelated-user denial, set:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `VIPER_FLEET_ENABLED` | `true` after live permission checks |
| Variable | `VIPER_FLEET_CONTAINER` | `iCloud.orbitusrobotics.ViperFleet` |
| Variable | `VIPER_FLEET_ENVIRONMENT` | `production` (or deliberate development test) |
| Secret | `VIPER_FLEET_API_TOKEN` | Website API token restricted to `https://www.orbitusrobotics.com` |

The website API token is necessarily public in rendered configuration. Never
substitute the private signing key or a CloudKit management token. Incomplete
enabled configuration fails the build. Turning off the portal does not revoke
reporting keys; use CloudKit Console to stop a compromised key.

The portal keeps records only in memory and clears them at sign-out/failure.
Receipt time comes from Apple's `modified.timestamp` system metadata and the
query sorts by `modifiedTimestamp`; no client can set this receipt field.
Reported health remains self-reported. The `ViperFleetStatus` schema grants
`FleetAdmin` read access and `FleetReporter` create, read and write access.
World, Authenticated and Creator have no grants on that record type. These
schema rules do not establish a per-key limit on an Apple server credential.

## Developer inventory groups

The optional GitHub Actions repository variable `VIPER_FLEET_INVENTORY_GROUPS` accepts a JSON array of unique opaque group codes. For example, `["cobalt","beta"]` uses synthetic codes. Each code starts with a lowercase letter and contains up to 24 lowercase letters or digits in total. Configured codes are public in the generated portal configuration. Leave the variable unset to keep the existing Fleet view.

In **Managed machines**, an authenticated operator can use **Inventory scope** to read the selected group’s Mac reports. **Default fleet** queries `ViperFleetStatus`. Each group queries its own `InventoryGroup_<code>` record type in the same configured container. CloudKit grants must control access to each record type. Switching scopes clears prior rows, visible details and pending results. The developer group view presents inventory status only.

Prepared recipient kits show **Waiting for cloud activation**, disable **Install and Share Status**, and start no reporter. There is no active developer-group download or verified production receipt. The proposed intake service would accept a revocable credential for inventory submissions to one assigned group. The credential could not authenticate directly to Apple. Only the server would hold the Apple signing key and choose the CloudKit destination. The guide shows the packaged pending state and the real portal with synthetic reports. [Developer inventory kit guide](https://www.orbitusrobotics.com/r/developer-inventory/)

## Verification

Run `node --test tests/viper-fleet.test.mjs`, the standard site build and
validators, and desktop/mobile browser checks. Verify the published ZIP and
page bytes against their source after deployment. The reporter's own tests
run in its repository on a macOS/Windows/Linux CI matrix. Mock tests do not
establish Apple authorization, a live accepted report or physical host coverage.
# Encrypted command queue (0.3 development pilot)

The Queue a payload tab imports the existing ViperLink payload export and
per-machine command-keys.json. It uses the signed-in CloudKit JS database and
never imports the server private key. Keys and decrypted content remain in
page memory and are cleared at sign-out. Jobs and returned files use the same
AES-GCM format as the native macOS/iOS controller and Node receiver. Source:
EndpointExecutionMonitor/ViperLink/Fleet/COMMANDS.md. Public downloads contain
the complete operator instructions and no enrollment credentials.

Activation is separate from status reporting: apply the additive development
schema for ViperFleetCommand/ViperFleetBlob, then set the Actions variable
VIPER_FLEET_COMMANDS_ENABLED=true. The default is false, displaying a staged
queue while keeping status reporting available. Do not activate before the
required owner permissions and live execution/receipt checks are verified.

RedAgent 0.3 adds the visible receiver and 1–1440 minute check-in setting.
Node.js 22 is required for cloud receiving; ordinary RedAgent features do not
require it. Polling is opt-in and stops when RedAgent closes. ViperLink's
native Cloud Fleet tab can queue without a Bonjour connection. Each host has
its own command key; the shared CloudKit credential alone cannot forge a job
for another enrolled host, but can disrupt the transport. Queue status is
untrusted until the receipt decrypts successfully. This is not hardware
attestation, and a controller holding the symmetric key can forge receipts.
