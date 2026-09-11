---
title: "ROBCodex Support"
description: "Download the Apple-notarized ROBCodex Bridge for Mac and connect ROBCodex on iPhone or iPad."
layout: "single"
url: "/robcodex/"
draft: false
---

ROBCodex turns the Mac bridge into a focused Codex workspace and securely carries the same sessions to an iPhone or iPad on your local Wi-Fi network. It is independent of ROBController and Cerebro.

## Replace terminal-tab sprawl

Keep several Codex conversations open in one horizontal session bar instead of spreading work across separate Terminal windows. Each tab has its own saved conversation, prompt draft, live stream, paging state, model, thinking effort, and Stop control, so sessions can work simultaneously without blocking or overwriting one another.

- **Work natively on the Mac.** ROBCodex Bridge now includes a terminal-style session workspace with searchable history, live command output, approvals, prompts, and per-session controls.
- **Continue from iPhone or iPad.** Open the same saved sessions, read their history, send or steer prompts, and stop an individual turn from a paired device. New sessions appear automatically while connected—no Refresh button required.
- **See what Codex is doing.** A live activity strip and structured cards show reasoning summaries, plan steps, tool progress, commands, and response output as the turn advances.
- **Make landscape count.** On iPhone, the session takes the full landscape width with a compact translucent title bar and composer, leaving more room for output without hiding the conversation title.
- **Tune each session.** Pick its Codex model and thinking effort on Mac, iPhone, or iPad. A compact status bar keeps the active configuration visible.
- **Recover cleanly.** Open tabs and their selected session survive relaunches, while bridge readiness and turn events keep every connected screen in sync.
- **Keep Codex local.** Your Codex login stays on the Mac; the bridge exposes only a small allowlist over an encrypted, paired local connection.
- **Allow Full Access.** ROBCodex sessions run without approval pauses so they remain usable remotely. Pair only devices you trust: a paired device can direct Codex to run commands and change files with your Mac user account's access.

## See the multi-session workspace

<figure class="not-prose my-8 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
  <img src="/images/robcodex/robcodex-iphone-landscape.webp" width="1434" height="660" loading="lazy" alt="ROBCodex filling an iPhone landscape screen with a live Codex transcript, reasoning summary, progress strip, and compact translucent composer" class="mx-auto h-auto w-full rounded-xl">
  <figcaption class="px-2 pb-1 pt-3 text-sm text-slate-300">The full-width iPhone landscape workspace keeps the title, live status, reasoning summary, and more transcript output visible at once.</figcaption>
</figure>

<div class="not-prose my-8 grid grid-cols-1 gap-6 md:grid-cols-2">
  <figure class="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
    <img src="/images/robcodex/robcodex-iphone-sessions.webp" width="736" height="1600" loading="lazy" alt="ROBCodex on iPhone showing the current Codex activity, reasoning summary, command output, and session controls" class="mx-auto h-auto w-full rounded-xl">
    <figcaption class="px-2 pb-1 pt-3 text-sm text-slate-300">Live status and reasoning-summary cards make the current work visible throughout a turn.</figcaption>
  </figure>
  <figure class="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
    <img src="/images/robcodex/robcodex-ipad-sessions.webp" width="1400" height="1867" loading="lazy" alt="ROBCodex on iPad showing simultaneous session tabs, live progress, reasoning summary, and command output" class="mx-auto h-auto w-full rounded-xl">
    <figcaption class="px-2 pb-1 pt-3 text-sm text-slate-300">iPad keeps simultaneous sessions and structured Codex progress visible together.</figcaption>
  </figure>
</div>

## Download ROBCodex Bridge for Mac

<p><a href="/downloads/robcodex/ROBCodexBridge-macOS-universal-0.1.0.zip" download class="inline-block px-5 py-3 font-bold text-white no-underline bg-indigo-600 rounded-lg hover:bg-indigo-800 focus:ring-4 focus:outline-none focus:ring-indigo-300">Download ROBCodex Bridge 0.1.0</a></p>

The download is a universal application for Apple silicon and Intel Macs running macOS 14 or later. It is signed with the Orbitus Robotics Developer ID, uses Apple's hardened runtime, and is notarized by Apple.

- Version: `0.1.0` (build 1009)
- Size: 4,507,934 bytes
- SHA-256: `ad26cffbb87cd46d92fdb4deae6e92e7900c36c359698bd08c11d5c87deef86f`

## Connect your devices

1. Download and unzip **ROBCodex Bridge** on your Mac.
2. Move **ROBCodex Bridge.app** to your Applications folder and open it.
3. Make sure the Codex CLI is installed and signed in on the Mac.
4. Open ROBCodex on the iPhone or iPad while both devices are on the same Wi-Fi network.
5. Select the Mac, compare the six-digit code on both screens, request pairing on iOS, and approve it on the Mac.

No API key, SSH key, or Codex password is copied to the iPhone or iPad. Codex authentication remains on the Mac.

ROBCodex deliberately keeps session permissions at **Allow Full Access**. It does not pause a remote session for command or file-change approvals, so only pair an iPhone or iPad you trust.

## Help and privacy

For installation or connection help, use the [Orbitus Robotics contact form](/contact/). Learn how local session data and pairing information are handled in the [ROBCodex privacy policy](/privacy/robcodex/).
