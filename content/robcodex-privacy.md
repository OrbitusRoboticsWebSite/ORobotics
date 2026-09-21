---
title: "ROB Code Privacy"
description: "Privacy policy for the ROB Code iPhone, iPad, and Mac apps."
layout: "single"
url: "/privacy/robcodex/"
draft: false
---

Last updated: September 21, 2026

ROB Code does not collect, track, sell, or share personal data. It contains no advertising, third-party analytics, crash-reporting, or telemetry SDKs, and the iPhone and iPad app does not require an Orbitus Robotics account.

## Local-network communication

ROB Code uses Apple's local-network and Bonjour technologies to discover a Mac running ROB Code Bridge. Discovery begins only after you grant Apple's Local Network permission.

After you compare a six-digit code and approve pairing, session metadata, conversation content, streamed Codex output, prompts, and command or file-change approval decisions travel directly between the paired devices through an encrypted local-network connection. ROB Code has no cloud relay, and Orbitus Robotics does not receive or store this content.

## Credentials and authentication

Your Codex credentials and authentication state remain in the Codex installation on your Mac. The iPhone and iPad app does not receive or store a Codex API token, password, or account credential.

ROB Code creates a device identity for secure pairing. Device identities and pinned peer records are stored in Apple Keychain using device-only accessibility and are not synchronized to Orbitus Robotics.

## Codex services

The Codex installation on your Mac may communicate with OpenAI according to your Codex account, configuration, and OpenAI's policies. That communication is performed by Codex and is separate from ROB Code's local bridge. ROB Code does not add an Orbitus Robotics server between Codex and your devices.

## Offline demo and data deletion

The optional offline demo contains fixed sample data, does not connect to a Mac, and performs no networking.

You can remove a paired device from ROB Code or ROB Code Bridge at any time. Deleting the apps removes their locally stored data according to Apple's platform behavior. Because Orbitus Robotics does not collect ROB Code session data, there is no Orbitus Robotics cloud account or session-data record to delete.

## Contact

Questions about this policy can be sent through the [Orbitus Robotics contact page](/contact/) or by email to [orbitus@orbitusrobotics.com](mailto:orbitus@orbitusrobotics.com).
