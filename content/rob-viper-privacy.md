---
title: "ROB Viper privacy and security scope"
url: "/products/rob-viper/privacy/"
draft: false
description: "What the ROB Viper development preview records, how managed policies work, and the current limits of its protection."
---

ROB Viper is a development preview from Orbitus Robotics. There is no public production installer yet.

The execution service records selected process and file events locally, including timestamps, executable and object paths, process identifiers, code-signing identity, CDHashes, policy results, and loss/error counters. Paths can contain personal information. It does not collect command arguments, environment values, file contents, camera data, or microphone data. Logs rotate across five files of at most 4 MiB each, with owner-only access. Exports contain the rows the operator chooses to display.

The network-filter implementation evaluates available destination metadata against explicit rules. It does not request packet payloads, decrypt TLS, record full browsing content, or upload browsing data. Hostname matching depends on what macOS supplies; IP-only flows cannot match a domain rule. Unknown destinations are allowed. Live filtering validation remains pending.

The current agent does not automatically upload events or enroll a Mac. An organization’s MDM and inventory server has its own data collection, retention, administrator permissions, and privacy responsibilities. Installing an MDM profile is a separate, visible administrative action. Managed policies can restrict local changes; device owners should consult their organization’s support contact.

The preview implements exact executable deny rules and destination rules. It does not include a maintained malware-signature feed, behavioral detection model, cleanup engine, complete script controls, or tamper-resistant enforcement. Live execution blocking, managed-fleet rollout, and recovery tests must pass before production availability. Keep Apple’s built-in security protections and system updates enabled.

Security reports and questions: [orbitus@orbitusrobotics.com](mailto:orbitus@orbitusrobotics.com?subject=ROB%20Viper%20security%20report). Please send a description first, without passwords, private keys, or unrelated personal logs. We can arrange an appropriate way to exchange a minimal reproduction.

Last updated November 6, 2026.
