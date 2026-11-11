# Viper Fleet staged portal

Unlisted URL: https://www.orbitusrobotics.com/viper-fleet/

The buildless portal is under `static/viper-fleet/`, so Hugo does not put it in
its page list, search, RSS or sitemap. Do not add a navigation or catalog link.
It requests `noindex, nofollow, noarchive`; anyone who knows or discovers the
URL can load the shell and its invented sample data. Privacy relies on live
CloudKit permissions, not on hiding this path. No private machine data belongs
in this repository or static hosting output.

Backend source, schema, provisioning and setup instructions are in
`EndpointExecutionMonitor/ViperLink/Fleet/README.md` in the ROB Viper repository:
https://github.com/RudyAramayo/EndpointExecutionMonitor/tree/main/ViperLink/Fleet

## Current state

Staging only. The source `config.json` disables live access and contains no
credentials. Apple sign-in and real report storage have not been activated or
tested against the new container. The sample button is local and displays five
invented machines across macOS, Windows and Linux. The intake code exposes only
status reporting, not remote command execution.

## Deployment configuration

After the dedicated CloudKit production schema and FleetAdmin permissions have
been verified, configure these repository Actions values:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `VIPER_FLEET_ENABLED` | `true` only after live acceptance checks |
| Variable | `VIPER_FLEET_CONTAINER` | Dedicated ViperLink container ID |
| Variable | `VIPER_FLEET_ENVIRONMENT` | `production` |
| Variable | `VIPER_FLEET_INTAKE_URL` | Deployed HTTPS URL ending in `/v1/check-in` |
| Secret | `VIPER_FLEET_API_TOKEN` | Origin-restricted website API token |

The website API token is necessarily public in the rendered configuration.
Never use a CloudKit private key, device bearer token or management token here.
The new hook fails the build when enabled configuration is incomplete; missing
enablement retains the inert preview. Turning the website off does not revoke
device credentials or stop an already deployed Worker; disable/revoke those
separately.

The frontend uses Apple's CloudKit JS sign-in, with data only in page memory.
Only the FleetAdmin role can read `ViperFleetStatus` in the dedicated container's
restricted public database scope. Test actual anonymous, unrelated Apple
account and owner access before enabling live mode. No public leaderboard
permissions or existing Musimotion data are changed.

Validation: `node --test tests/viper-fleet.test.mjs`, the standard website build
and validators, and desktop/mobile browser checks. The full intake permission
and signature tests live in the ROB Viper repository. Mock tests do not establish
that Apple's live authorization or cloud deployment works.
