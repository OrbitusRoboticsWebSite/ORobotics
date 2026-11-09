---
title: "ROBCodeAgent Privacy"
description: "Privacy policy for the ROBCodeAgent iPhone, iPad, and Mac apps."
layout: "single"
url: "/privacy/robcodex/"
draft: false
---

Last updated: November 8, 2026

ROBCodeAgent does not collect, track, sell, or share personal data. It contains no advertising, third-party analytics, crash-reporting, or telemetry SDKs, and the iPhone and iPad app does not require an Orbitus Robotics account.

## Local-network communication

ROBCodeAgent uses Apple's local-network and Bonjour technologies to discover a Mac running ROBCodeAgent Bridge. Discovery begins only after you grant Apple's Local Network permission.

After you compare a six-digit code and approve pairing, session metadata, conversation content, streamed Codex output, prompts, and command or file-change approval decisions travel directly between the paired devices through an encrypted local-network connection. ROBCodeAgent has no cloud relay, and Orbitus Robotics does not receive or store this content.

## Credentials and authentication

Your Codex credentials and authentication state remain in the Codex installation on your Mac. The iPhone and iPad app does not receive or store a Codex API token, password, or account credential.

ROBCodeAgent creates a device identity for secure pairing. Device identities and pinned peer records are stored in Apple Keychain using device-only accessibility and are not synchronized to Orbitus Robotics.

## Codex services

The Codex installation on your Mac may communicate with OpenAI according to your Codex account, configuration, and OpenAI's policies. That communication is performed by Codex and is separate from ROBCodeAgent's local bridge. ROBCodeAgent does not add an Orbitus Robotics server between Codex and your devices.

## Optional voice and goals

In version 0.1.3, calls start muted. Unmute requests microphone and speech-recognition permission and uses Apple on-device recognition only when supported for the current language. Call audio is not uploaded or recorded. Your transcript stays in memory until you send it or the unchanged ten-second countdown expires. Editing cancels automatic sending. Sent text travels to the Mac and selected session. New updates are read locally using a synthesized voice, with a bounded in-memory replay history.

Sending mutes capture for playback. End Call, backgrounding, disconnection, interruption, or route removal ends audio and holds unsent text. Done dismisses the panel while a foreground call continues. Keep the app open while using a call. Ending a call does not cancel existing session work.

Optional script channels store their most recent 50 events, receipts, and pending reviewed replies in `~/Library/Application Support/ROBCodeAgent/Calls` on the Mac, restricted to that Mac user. Paired devices can view script channels. Consumed replies are removed by the helper; channel records and receipts can be removed by the user from that directory. No internet relay, additional network listener, or shell evaluation is added.

Earlier version 0.1.2 realtime voice sends microphone audio through the paired Mac to OpenAI using the Mac's Codex authentication; its audio and conversation data follow that account's policies. Upgrade both apps to use reviewed-text calls. Neither version saves audio recordings or sends content to Orbitus Robotics.

Goals remain stored with the Mac's Codex threads and may continue across turns until paused, cleared, completed, or limited by Codex usage or an optional token budget.

## Offline demo and data deletion

The optional offline demo contains fixed sample data, does not connect to a Mac, and performs no networking.

You can remove a paired device from ROBCodeAgent or ROBCodeAgent Bridge at any time. Deleting the apps removes their locally stored data according to Apple's platform behavior. Because Orbitus Robotics does not collect ROBCodeAgent session data, there is no Orbitus Robotics cloud account or session-data record to delete.

## Contact

Questions about this policy can be sent through the [Orbitus Robotics contact page](/contact/) or by email to [orbitus@orbitusrobotics.com](mailto:orbitus@orbitusrobotics.com).
