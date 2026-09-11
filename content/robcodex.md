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
- **See the thinking and the conclusion.** A live activity strip and structured cards show detailed reasoning summaries, plan steps, tool progress, commands, and the completed Codex answer together in the turn transcript.
- **Make landscape count.** On iPhone, the session takes the full landscape width with a compact translucent title bar and composer, leaving more room for output without hiding the conversation title.
- **Choose current and future models.** A labeled menu loads the signed-in Mac account's live Codex catalog, including GPT-6 Astra when available, so new models do not require a ROBCodex update.
- **Control thinking depth.** A neighboring menu exposes every level the selected model supports—including Max or Ultra when available—for both new and existing sessions on Mac, iPhone, and iPad.
- **Recover cleanly.** Open tabs and their selected session survive relaunches, while bridge readiness and turn events keep every connected screen in sync.
- **Keep Codex local.** Your Codex login stays on the Mac; the bridge exposes only a small allowlist over an encrypted, paired local connection.
- **Allow Full Access.** ROBCodex sessions run without approval pauses so they remain usable remotely. Pair only devices you trust: a paired device can direct Codex to run commands and change files with your Mac user account's access.

## See the multi-session workspace

<figure class="not-prose my-8 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
  <img src="/images/robcodex/robcodex-iphone-landscape.webp" width="1434" height="660" loading="lazy" alt="ROBCodex filling an iPhone landscape screen with GPT-6 Astra and thinking-depth menus, live progress, reasoning summary, and a compact translucent composer" class="mx-auto h-auto w-full rounded-xl">
  <figcaption class="px-2 pb-1 pt-3 text-sm text-slate-300">The full-width iPhone landscape workspace keeps the GPT-6 Astra and thinking-depth choices beside the title while leaving more room for live output.</figcaption>
</figure>

<div class="not-prose my-8 grid grid-cols-1 gap-6 md:grid-cols-2">
  <figure class="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
    <img src="/images/robcodex/robcodex-iphone-sessions.webp" width="736" height="1600" loading="lazy" alt="ROBCodex on iPhone showing GPT-6 Astra, Thinking High, current Codex activity, a reasoning summary, and command output" class="mx-auto h-auto w-full rounded-xl">
    <figcaption class="px-2 pb-1 pt-3 text-sm text-slate-300">Direct model and thinking-depth menus sit above live status and detailed reasoning-summary cards.</figcaption>
  </figure>
  <figure class="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
    <img src="/images/robcodex/robcodex-ipad-sessions.webp" width="1400" height="1867" loading="lazy" alt="ROBCodex on iPad showing simultaneous sessions, GPT-6 Astra and thinking-depth controls, live progress, reasoning summary, and command output" class="mx-auto h-auto w-full rounded-xl">
    <figcaption class="px-2 pb-1 pt-3 text-sm text-slate-300">iPad keeps simultaneous sessions, model and thinking-depth controls, and structured Codex progress visible together.</figcaption>
  </figure>
</div>

## Download ROBCodex Bridge for Mac

<p><a href="/downloads/robcodex/ROBCodexBridge-macOS-universal-0.1.0.zip" download class="inline-block px-5 py-3 font-bold text-white no-underline bg-indigo-600 rounded-lg hover:bg-indigo-800 focus:ring-4 focus:outline-none focus:ring-indigo-300">Download ROBCodex Bridge 0.1.0</a></p>

The download is a universal application for Apple silicon and Intel Macs running macOS 14 or later. It is signed with the Orbitus Robotics Developer ID, uses Apple's hardened runtime, and is notarized by Apple.

- Version: `0.1.0` (build 1010)
- Size: 4,534,323 bytes
- SHA-256: `e5371b6a98b554f49ebd1a2569386e5a124067d157ee2ec87ca764e368c71074`

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
