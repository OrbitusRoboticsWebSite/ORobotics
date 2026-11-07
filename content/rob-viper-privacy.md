---
title: "ROB Viper privacy and security scope"
url: "/products/rob-viper/privacy/"
draft: false
description: "What the ROB Viper development preview records, how managed policies work, and the current limits of its protection."
---

ROB Viper is a development preview from Orbitus Robotics. There is no public production installer yet.

The execution service records selected process and file events locally, including timestamps, executable and object paths, process identifiers, code-signing identity, CDHashes, policy results, and loss/error counters. Paths can contain personal information. It does not collect command arguments, environment values, file contents, camera data, or microphone data. Logs rotate across five files of at most 4 MiB each, with owner-only access. Exports contain the rows the operator chooses to display.

The network filter evaluates application and actual-process identity, destination metadata, ports, protocols and direction against explicit rules and profiles. Allow, Deny and Ask are available; Audit allows connections while recording would-deny or would-ask decisions. Ask has a bounded timeout and a configured fallback when the GUI is unavailable. Enforce denies identity-resolution deadlines or overload. No DNS, update or management exceptions are added automatically. Existing flows may continue until closed.

Connection history is optional. When enabled, it stores app/executable identities, remote IPs and available hostnames, ports, direction, timing, decisions and byte totals on this Mac. It does not request packet payloads, decrypt TLS, retain full URLs or upload browsing history. Retention is bounded by the chosen age, row limit and a 256 MiB database cap plus a bounded journal. The directory and database are private to the service; its control connection requires the exact signed host and the active console owner. Exports contain loaded visible rows and should be shared deliberately. Some short flows receive no byte totals from macOS; displayed accounting can therefore be incomplete.

A reverse-DNS lookup runs only when requested in the connection inspector. It sends the selected public IP in a PTR query to the configured DNS resolver and caches the result locally. PTR names are untrusted labels and never grant an allow rule. Domain matching requires a hostname supplied by macOS. An approved shared IP may serve several websites; the preview does not provide complete DNS-aware website identity enforcement.

Blocklist updates contact the HTTPS URL selected by the operator. That publisher sees the download request and source IP under its own privacy policy; the request does not upload connection history. Downloads are bounded, use no stored cookies or credentials, and reject malformed replacements while keeping the last valid list. The offline map uses bundled Natural Earth land shapes and an optional local DB-IP City Lite CSV. Destination IPs are not sent to a geolocation service. Locations describe approximate network endpoints, not a person’s location. Notifications are opt-in and rate-limited while Network Control is open.

Scoped live tests verified Audit, an exact-build deny, an answered approval, reverse DNS and filtering shutdown. Those checks are distinct from broad network, managed-fleet or multi-user security validation. The repository includes reproduction instructions for app-identity spoofing, malformed policy and blocklist inputs, prompt replay, overload, history access and the macOS service-upgrade regression.

The current agent does not automatically upload events or enroll a Mac. An organization’s MDM and inventory server has its own data collection, retention, administrator permissions, and privacy responsibilities. Installing an MDM profile is a separate, visible administrative action. Managed policies can restrict local changes; device owners should consult their organization’s support contact.

The preview implements exact execution deny rules and application/destination network controls. It does not include a maintained malware-signature feed, behavioral detection model, cleanup engine, complete script controls, or tamper-resistant enforcement. Live execution blocking, managed-fleet rollout, and recovery tests must pass before production availability. Keep Apple’s built-in security protections and system updates enabled.

Security reports and questions: [orbitus@orbitusrobotics.com](mailto:orbitus@orbitusrobotics.com?subject=ROB%20Viper%20security%20report). Please send a description first, without passwords, private keys, or unrelated personal logs. We can arrange an appropriate way to exchange a minimal reproduction.

Last updated November 6, 2026.
