---
title: "SignalAtlas Privacy Policy"
url: "/products/signalatlas/privacy/"
draft: false
description: "How SignalAtlas and SignalAtlas GPS handle local survey data, location permissions, pairing and exports."
---

Effective November 7, 2026. Applies to SignalAtlas for Mac 1.0 and SignalAtlas GPS 1.0 for iPhone and iPad.

## Your survey stays on your devices

Orbitus Robotics does not collect survey observations, location, identifiers, usage analytics or advertising data from these apps. They have no account, advertising, tracking SDK or developer cloud relay.

The Mac app saves Wi-Fi and Bluetooth observations, timestamps, receiver locations when available, source labels, survey sessions and watchlist settings locally. Wireless names and identifiers and precise receiver locations can be sensitive. Exporting JSON, CSV or GeoJSON creates a file in the location you choose. You decide whether to share that file.

## Permissions and local pairing

Mac Location Services supports receiver geotags and Wi-Fi identifier access. Bluetooth permission supports discovery of advertising peripherals. SignalAtlas does not join networks, capture network traffic or connect to discovered Bluetooth peripherals.

SignalAtlas GPS requests location while the companion is in use. When you choose Start GPS sharing, it sends location, accuracy, timestamp, source and device name directly to your paired Mac on the local network. Keep the phone or tablet beside the Mac. Sharing stops when you tap Stop sharing or the app enters the background.

Camera access is only for scanning a pairing QR code. Camera images are not stored or uploaded by the app. You can paste a pairing code instead. Bonjour discovery and a pinned TLS 1.3 connection over QUIC use Local Network permission. Pairing credentials are stored in Keychain; treat pairing codes as private credentials.

## Apple services and external hardware

The Mac map uses Apple's MapKit basemap. Loading maps sends normal map requests to Apple under [Apple's privacy policy](https://www.apple.com/legal/privacy/). Operating-system location services, App Store purchases and any diagnostics you choose to share with Apple follow Apple's policies. Orbitus does not receive your payment information.

An optional external NMEA receiver or stream is read only when selected. Its location fixes are saved with the survey. No external receiver is required for the main interface.

## Retention and your choices

Surveys remain in the Mac app's local database until you remove that data. The current release has no in-app survey-delete or import command. Use Show local database to locate the store; export anything you want to retain and quit the app before managing its files. See the [manual]({{< relref "signalatlas-manual.md" >}}) for backup and recovery notes. Removing the app alone may leave local data or Keychain items behind.

You can revoke Location Services, Bluetooth, Camera or Local Network access in system settings. Export files and backups are separate copies under your control. No server-side account exists to delete.

## Support and policy changes

If you contact support, the information you voluntarily send is used to answer your request. Do not send pairing secrets, unrelated private data or unredacted survey exports unless necessary for the issue. Contact [Orbitus Robotics support]({{< relref "contact.md" >}}). Future changes to these practices will be reflected here and in the App Store privacy details.

[Back to SignalAtlas]({{< relref "signalatlas.md" >}})
