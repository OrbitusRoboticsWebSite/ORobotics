---
title: "SignalAtlas User Manual"
url: "/products/signalatlas/manual/"
draft: false
description: "How to record wireless surveys, read radar and map views, pair the GPS companion, use NMEA receivers and export your observations."
---

[Back to SignalAtlas]({{< relref "signalatlas.md" >}}) · [Download the illustrated PDF]({{< asset-url "downloads/signalatlas/SignalAtlas-User-Manual.pdf" >}})

This HTML edition provides selectable text and semantic headings. The 14-page PDF is also bundled in the Mac app's Help menu.

Version 1.0 - November 2026

## Start here

Record what your Mac can observe, keep the evidence, and understand what the measurements mean.

### What SignalAtlas does

SignalAtlas records nearby Wi-Fi observations and Bluetooth Low Energy advertisements. It combines a signal-strength radar, a receiver-location map, saved survey sessions, a watchlist, and JSON, CSV and GeoJSON exports. It works without an account or a cloud survey service.

### What you need

Use a Mac running macOS 14 or later with supported Wi-Fi and Bluetooth hardware. The optional free SignalAtlas GPS companion requires iOS or iPadOS 17 or later and the separately purchased Mac app. The Mac can also use its own Location Services or a selected external NMEA stream. Internet access is needed to load Apple's basemap; local survey recording does not require an Internet service.

### Learn with the example

Choose Open example survey in the sidebar. The orange DEMO banner identifies synthetic signals and coordinates. Explore Overview, Radar, Map and History. This example stays in memory and is never inserted into the real survey database. Example exports are marked DEMO.

### The essential distinction

A signal reading is an observation at a receiver. A map pin marks where the receiver was, not where a transmitter is. Radar angles are illustrative, not measured bearings. Signal strength is not a calibrated distance measurement.

> For your first survey, leave the filters at their defaults and stop recording before changing radios or switching sessions.

## Permissions and first launch

Each permission supports a specific feature. Missing permission should produce a clear limitation, not invented data.

### Location Services on the Mac

When you start a survey, macOS may request location access. This supports receiver geotags and access to Wi-Fi identifiers. Even when a phone supplies the receiver position, macOS still controls whether the Mac can read Wi-Fi names and identifiers. Review System Settings > Privacy & Security > Location Services if names are unavailable.

### Bluetooth

Allow Bluetooth access to discover advertising Bluetooth LE peripherals. Discovery does not connect to those peripherals. If access is denied or Bluetooth is off, read the radio status near the bottom of the sidebar and review System Settings > Privacy & Security > Bluetooth.

### Local Network

The optional companion connection uses Bonjour on the local network. Allow Local Network access on both devices when requested. This permission is for the phone-to-Mac connection; it does not grant Wi-Fi scan access on iOS.

### Camera and precise location on the companion

Camera access is used only to scan the Mac's pairing QR code. You can paste the pairing code instead. Allow location access while using the companion; Precise Location improves tagging when available. Reduced-accuracy fixes are labeled. A Wi-Fi-only iPad can provide a less precise location than a GPS-capable device.

### Try without collecting

Open example survey to learn the views without starting radio discovery. Permission prompts and actual device coverage are separate from the example data.

> Changing a permission in System Settings may require stopping and starting a new survey. Check the status text after the change.

## Record a survey

Choose your acquisition source before pressing Start survey. Each start creates a separate saved session.

### 1. Choose the radios

Enable Wi-Fi observations, Bluetooth LE advertisements, or both. These controls are disabled during a survey. Stop first if you need to change them.

### 2. Choose the Wi-Fi source

OS cache - no scan requested reads the system's cached results. The cache's measurement time is unknown, so cached rows are identified and never receive a fresh location tag. System scans - may send probes requests CoreWLAN scans approximately every 10 seconds. Scans run off the main thread and do not overlap.

### 3. Start and inspect status

Press Start survey. The footer changes to RECORDING LOCALLY. Watch the radio status and receiver-location summary. If there is no fresh fix, observations can still be saved without coordinates. A zero count may reflect permission, hardware, radio state or the surrounding environment.

### 4. Move deliberately

For a repeatable site survey, pause at planned observation points, keep the receiver orientation consistent and note your route separately. If using the companion, keep it beside the Mac. Walls, people, reflections and antenna orientation can change RSSI without a transmitter moving.

### 5. Stop and review

Press Stop survey to end recording and flush observations to the local database. Choose the saved session in the sidebar to revisit it. Export while the correct session is selected.

> The app does not join networks or capture traffic. System Wi-Fi scans and BLE discovery may transmit probe or scan requests; this is not a radio-silent monitor-mode tool.

## Read the radar

Use the radar to compare visible signals and follow their strength over time.

### Nearer the center means stronger RSSI

A less negative RSSI reading is stronger: -45 dBm is stronger than -80 dBm. The radar uses smoothed strength to reduce jitter. It is useful for relative comparison, but it does not convert the reading into a verified physical distance.

### Angles are illustrative

Each signal identity receives a stable display angle. Turning the Mac does not turn this into a direction finder. Do not follow a dot as though it identifies the transmitter's compass bearing.

### Labels, age and selection

Enable Names to show named Wi-Fi signals. Old or cached dots are faded. Click a dot or signal row to inspect its identity, first-seen time, peak strength and recent RSSI chart. Click the close button in the detail area to clear the selection.

### Identity has limits

Wi-Fi tracks generally use BSSID. BLE tracks use the peripheral UUID supplied by Apple, not a Bluetooth MAC address. Randomized identities can split one physical device into multiple tracks. A broadcast name or vendor string does not identify a person or a threat.

## Understand the map

A geotag answers: where was the receiver when this observation was made?

### Frame the sightings

Open Map and choose Fit to frame the available receiver sightings. Select a signal to focus the map on observations for that identity. Clear the selection to return to the broader set. The map displays up to the latest 1,000 matching sightings.

### Location source and freshness

The app prefers a fresh companion fix, then external NMEA, then Mac Location Services. Fixes older than 30 seconds or more than two seconds in the future are rejected. Each stored fix carries its timestamp, source and reported accuracy where available.

### Gaps are meaningful

The path breaks when the source changes or the gap between fixes exceeds 30 seconds. Missing coordinates are left missing. Cached Wi-Fi results are not assigned a new location because their original measurement time is unknown.

### Keep accuracy in context

Core Location may combine satellite, Wi-Fi and other positioning sources. The accuracy value describes the location estimate; it does not describe transmitter distance or radio detection confidence. Apple basemap availability is separate from local observation storage.

> Do not label receiver pins as access-point or device locations in reports. Preserve the coordinate meaning when sharing GeoJSON.

## History, filters and watchlist

Start with Latest per signal to see your neighbors, then examine individual observations when you need detail.

### Choose the history mode

Latest per signal shows one matching observation per Wi-Fi BSSID or BLE identifier. It keeps repeated readings from one strong signal from burying occasional neighbors. Every observation shows individual loaded samples. The count above the table tells you how many rows match.

### Use the shared filters

Search by name or identifier, select a radio, adjust Minimum signal, enable Seen in the last 45 seconds, or choose Watchlist only. These filters affect every view. History compares the threshold against each sample; live tracks use smoothed RSSI.

### Recover apparently missing results

Choose Reset filters. Turn off the recency filter when viewing an older session. Switch between Latest per signal and Every observation, and compare BSSID, channel and receiver as well as the visible network name.

### Star a signal

Use the star button in the signals table to add or remove an identity from the local watchlist. Then enable Watchlist only to concentrate on those identities. Watchlist membership does not mean a signal is trusted, owned or dangerous.

### Know the display limit

The interface loads the most recent 20,000 records from a session. The saved count can therefore exceed the loaded count. JSON, CSV and GeoJSON exports use the full selected session, not just the currently displayed or filtered rows.

> SSID not provided means the observation has no readable network name. It does not prove the network deliberately hides its SSID.

## Pair the GPS companion

The free companion shares location with the paired Mac. Radio surveys continue to run on the Mac.

### 1. Enable the Mac receiver

In SignalAtlas, choose iPhone AutoNet, then Enable iPhone receiver. The panel displays a QR pairing code and a Copy pairing code button. Keep this code private: it contains pairing credentials.

### 2. Pair on iPhone or iPad

Open SignalAtlas GPS and choose Scan Mac pairing QR code. If the camera scanner is unavailable, copy the code on the Mac, transfer it privately and paste it into the pairing field, then choose Pair with code. Both devices must be on a local network that permits peer discovery and connections.

### 3. Start sharing

Choose Start GPS sharing in the companion and grant the relevant permissions. Check that the companion reports a paired Mac connection and that the Mac displays the companion's current location source. Bonjour finds the paired Mac automatically after pairing.

### 4. Keep both devices together

The phone's coordinates tag observations received by the Mac. Keep the devices beside one another so that this relationship is accurate. Leave the companion in the foreground. Sharing keeps its screen awake and stops when it enters the background.

### 5. Stop or disconnect

Choose Stop sharing on the companion to stop sending locations. Disable iPhone receiver on the Mac to close its incoming connections. Stale fixes are rejected, and the Mac can fall back to another fresh source.

> The App Store companion contains no private Wi-Fi scanning code. It does not import AirPort Utility results or turn the iPhone into a general Wi-Fi scanner.

## Use external NMEA GPS

Use a compatible receiver when you need a dedicated location source for a field session.

### Connect explicitly

Expand External NMEA GPS in the sidebar and choose Open GPS stream. Select your receiver's serial device or readable stream. SignalAtlas opens only the source you choose and does not automatically probe unrelated devices.

### Configure the receiver first

Set the receiver's serial baud and output mode using its own software or documented configuration tools. SignalAtlas does not configure serial baud. The source must provide checksummed RMC or GGA sentences with valid coordinates and time information.

### Check the source label

Read the external GPS status and the footer's location summary. A valid incoming sentence is different from a fresh fix selected for tagging. The companion still takes priority when it has a fresh fix.

### Understand quality fields

Invalid or stale fixes are not used. Horizontal dilution of precision (HDOP) is not presented as metre accuracy. If no metre accuracy is available, the app says accuracy unknown rather than inventing a value.

### Disconnect cleanly

Use Disconnect when finished. If the stream ends or errors, the app stops using that stream and updates its status. It can continue recording unlocated observations or use another fresh location source.

> If a source never produces a fresh fix, check its date, UTC time, checksum, baud configuration and fix validity before relying on the map.

## Export useful evidence

Choose the correct saved survey before exporting. Filters affect the display, not the export's full-session scope.

### Export the selected session

Open Export in the toolbar and choose JSON, CSV or GeoJSON, then choose a destination in the macOS Save panel. The File menu provides the same formats. Stop the survey first when you want a clearly bounded final report.

### JSON: preserve the structured record

JSON includes schemaVersion, coordinateMeaning, session metadata and observations. Use it to retain the richest source record for your own tools. Version 1.0 does not provide a general import-and-merge workflow; keep the original database as well as exports.

### CSV: compare in a spreadsheet

CSV includes identity, radio, name, observed/read time, RSSI, channel, frequency, security, cache state, coordinates, accuracy, fix time, location source, services, manufacturer data and transmit power where available. Empty fields mean unavailable data. Broadcast text that could execute as a spreadsheet formula is escaped.

### GeoJSON: map valid receiver points

GeoJSON contains valid, located, non-cached observations as Point features. Coordinates are longitude, latitude. The unlocated_observations field counts records without exported points. Preserve the receiver-observation label when importing into GIS tools.

### Share deliberately

Exports can contain network identifiers, device identifiers, timestamps and precise locations. Review the selected session and destination before sharing. Demonstrations should use the clearly labeled example survey instead of exposing a real survey.

> Keep source, acquisition mode, time and coordinate meaning with the result. A spreadsheet chart is not independent verification of a transmitter's location.

## Privacy, storage and recovery

Survey data is stored locally. You decide when and where to export it.

### Local storage

Saved sessions use a SQLite database named observations.sqlite in the app's Application Support/SignalAtlas folder. The sandboxed Mac App Store edition stores this within its macOS app container. Earlier development builds used ~/Library/Application Support/SignalAtlas. Version 1.0 does not automatically merge those separate stores.

### Protect a backup

Stop recording and quit the app before making a filesystem backup. Back up the app's full data container using your normal Mac backup system. SQLite may use companion WAL and SHM files while open; copying only the main file from a running app can omit recent changes.

### No survey telemetry service

SignalAtlas has no account, advertising or analytics uploader. The paired companion sends location to your Mac over the local network using pinned TLS 1.3 and mutual authentication. Pairing material is stored in Keychain. Apple maps and operating-system location services have their own network behavior and privacy terms.

### If saving fails

Recording stops and an alert reports the problem and the observations still in memory. Resolve storage or access issues and choose Retry saving before quitting. Do not assume unsaved in-memory observations survived a crash or forced exit.

### Removal and retention

Version 1.0 does not include per-session deletion in the interface. Exports are ordinary files you manage in Finder. For a full local reset or recovery, contact support and make a backup first. Uninstalling an app alone may leave its container or Keychain material behind.

> Never publish a pairing QR code with a screenshot. Use the example survey for store images, manuals and demonstrations.

## Troubleshooting

Read the acquisition and permission status before interpreting an empty or surprising view.

### No Wi-Fi names or fewer networks than another device

Review Mac Location Services, Wi-Fi state and acquisition mode. OS cache and a requested scan are different sources. Compare the same BSSID, time and receiver. A network observed by AirPort Utility on an iPhone was not necessarily observed by this Mac.

### History only shows one network

Choose Reset filters and Latest per signal. Check the selected session, radio, watchlist, minimum RSSI and last-45-seconds filters. Inspect identifiers and channels rather than relying on a shared SSID.

### Map is empty

Check for a fresh receiver fix and verify that observations are not cached. A saved observation without coordinates is still a valid radio record. Choose Fit. If pins exist but the basemap is blank, check the Internet connection.

### Companion will not connect

Enable the Mac receiver, keep both apps open and review Local Network permissions. Check that both devices use a reachable local network; guest-network client isolation, VPN routing or firewall policy may block discovery. Confirm the pairing belongs to this Mac. Do not disable unrelated security protections to troubleshoot.

### Location stops updating

Keep the companion in the foreground and beside the Mac. Review location permission and accuracy, check the external GPS if used, and read the source/age summary. Fixes that are too old or future-dated are deliberately rejected.

### BLE devices are missing

Confirm Bluetooth is on and allowed. Only advertising Bluetooth LE peripherals exposed by CoreBluetooth are visible; classic Bluetooth and silent peripherals are outside that discovery scope. Randomized identities can change the apparent track count.

## Quick reference and support

A short repeatable routine makes a field notebook more useful than a collection of unexplained dots.

### Before recording

Choose the radios and acquisition source. Confirm permissions. Check the receiver source, age and accuracy. Reset filters. Keep the companion beside the Mac if using one.

### After recording

Stop the survey. Check the saved and loaded counts. Review History and map gaps. Export the full session and preserve its acquisition context. Review locations and identifiers before sharing.

### Keyboard shortcuts

Command-N starts a new survey when stopped. Command-period stops a survey. Command-E opens JSON export. CSV and GeoJSON exports are available in the File menu. Open Help > SignalAtlas User Manual for the bundled PDF.

### Terms

RSSI is received signal strength in dBm. SSID is a Wi-Fi network name. BSSID identifies a Wi-Fi access-point interface. BLE means Bluetooth Low Energy. A receiver fix is a timestamped location estimate. A cached record has an unknown original measurement time.

### Get help

Visit https://www.orbitusrobotics.com/products/signalatlas/ or email orbitus@orbitusrobotics.com. Include the app version, macOS/iOS version, acquisition mode, permission status and steps to reproduce. Send a screenshot with private identifiers, coordinates and pairing codes removed. Do not send full real survey files unless support specifically needs them and you choose to share them.

### About this guide

This manual describes the SignalAtlas 1.0 Mac App Store release and its public-API GPS companion. Store submission, Apple review and public availability are separate states. The product page carries the current release status. The earlier private-API iPhone research prototype is not the App Store companion.
