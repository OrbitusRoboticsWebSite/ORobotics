---
title: "Musimotion visionOS development guide"
url: "/products/musimotion/vision-guide/"
draft: false
description: "Learn the Musimotion spatial preview: enter and exit 3D, adjust comfort controls, edit objects, paint Sumi ink, and understand current limits."
---

[Back to Musimotion]({{< relref "musimotion.md" >}}) · [Product support]({{< relref "contact.md" >}})

Version 1.0 · November 19, 2026 · Spatial behavior baseline `8dc75b6`

This guide describes the native visionOS **development preview**. It is not an
App Store release. Mac 1.0.0 build 7 is separately approved and awaiting manual
release; the spatial changes described here are newer development work.

Use a disposable copy of a project. This preview can open and edit a
`.musimotion` package, but its standalone Save/Save As and autosave workflow is
incomplete. Keep the original on your Mac. The target supports visionOS 2 or
later; testing for this update used the visionOS 26.5 simulator. Physical
headset comfort, hand tracking, and sustained performance remain unverified.

## 1. Start in the window

1. Launch the development app. It starts with the editor window and paused
   playback; it does not enter an immersive space automatically.
2. Use **Open** to choose a copy of a `.musimotion` package, or explore the
   initial sample scene.
3. Find **Enter 3D** below the title, **Stage height** beside it, and **Play** in
   the bottom transport. The status initially says the window workspace is ready.
4. Use **Hide Menu** or **Show Menu** to change the sidebar. Scroll the sidebar
   to reach **Add Text**, **Effects**, and **Physics** when the window is small.

## 2. Set up a comfortable workspace

1. Choose a seated or standing posture with clear surrounding space. Keep the
   editor where you can read it with a relaxed head position.
2. Adjust **Stage height** before entering 3D. The initial height is 1.25 m and
   the adjustment range is 0.8–1.8 m. These are adjustable project defaults,
   not a guarantee of comfort for every person or room.
3. Turn on **Reduce ambient motion** to suppress decorative particles and
   dynamic physics. Deliberate timeline playback remains available.
4. The app also respects the system Reduce Motion preference. If movement is
   uncomfortable, use **Pause** or **Exit 3D** and stop the session.

## 3. Enter, edit, and reveal floating tools

1. Select **Enter 3D**. Wait for the status saying the immersive workspace is
   active. The button becomes **Exit 3D**. Entry controls are temporarily
   disabled while opening or closing.
2. The stage initially sits behind the editor window, with its canvas roughly
   2.3 m away. You can move the system window, but check for overlap afterward.
3. Select an object in **Layers** or look at a visible 3D object and pinch.
   Pinch and drag from the point you grabbed. The object should keep that
   offset instead of jumping its centre to the pinch point. Editing pauses playback.
4. Select **3D Tools** in the top bar to show floating controls. Select it again
   before returning to window controls if they overlap. Touch and hold an object
   to open its 3D edit menu. Hidden timeline objects cannot be selected.
5. Scrub the timeline, choose **Keyframe**, and use **Play** or **Pause** to
   preview. Manipulation and authored animation are distinct operations; check
   the intended playhead before editing a moving object.

## 4. Add text and media

1. Choose **Add Text** in the sidebar. Enter text, choose its formatting, then
   choose **Add**. For an existing text layer, choose **Edit Text** and **Update**.
2. Choose **Add Shape** for a shape. Select its layer to edit its properties.
3. Choose **Add Media**, then **Import or drop images and videos here**. Select
   only demonstration files you intend to include in the project.
4. Imported assets appear in the shelf. Select an asset to place it, or drag it
   into the immersive view. If the shelf is empty, the import control is the
   expected starting state, not an import success confirmation.

## 5. Paint with Sumi ink

1. Choose **Brushes**. The **Sumi Ink Studio** shows paper and brush controls.
2. Choose a brush preset, then adjust **Size**, **Flow**, **Translucency**, paper,
   and ink color. Start with a short stroke on the window's paper surface.
3. After release, the status should report that the stroke was composited into
   the final paint buffer. Inspect the mark before continuing.
4. To paint on the large immersive canvas, enter 3D and select **Space Off** so
   it becomes **Space On**. Its accessibility label is **Immersive Sumi Painting**.
5. Select **Space On** to disarm it, or use **Exit 3D**. Exiting disarms immersive
   painting and stops playback. **Clear Ink** removes the current raster paint.

Completed live-stroke playback is not yet fully reproduced by the spatial
renderer. Check a Mac rendering before treating the spatial view as final output.

## 6. Exit and recover

1. Select **Exit 3D**. The status should say **Window workspace is ready. Enter
   3D to return.** Playback is paused and immersive painting is disarmed.
2. Select **Enter 3D** again when ready. If opening is cancelled or fails, the
   window stays usable and the same button provides a retry.
3. Closing or backgrounding the window stops playback and requests dismissal
   of the immersive space. An entry still in progress is dismissed when it resolves.
4. If the stage or tools obscure a window after you move it, first hide
   **3D Tools**. Use **Exit 3D** if needed, reposition the system window, and
   reenter. Use the system's recentering controls when appropriate.

## AI, permissions, and sharing

**AI Create** sends the typed creative brief to Apple's on-device Foundation
Models framework when the model is available. Musimotion checks availability
before creating a session and uses an editable deterministic template when the
model is unavailable or the request fails. The native spatial creator does not
offer the Mac editor's full Image Playground workflow. Model availability varies
by device, OS, language, and region; it does not establish China app compliance.

**Open** and media import use the system file picker. Selecting a file gives the
app access to that file; it does not publish it. Basic window editing and the
standard look-and-pinch interaction do not require a custom raw-hand-tracking
permission. Honor any system permission request for the feature you choose.

**Share** exposes **Live Together**, **Send Clip**, **Invite People**, and
**Community**. Sharing can send the project, media, or rendered clip to other
people and Apple CloudKit. Community publication is public; an unlisted link can
be used by anyone who receives it. Only use sharing when you intend that transfer.
Simulator fixtures validate these controls without proving delivery, account
permissions, a live SharePlay session, or a community publication.

## What is verified and what remains

The November 19 run passed **99 Mac tests and 11 visionOS tests**, with no skips.
Coverage includes grab offsets, coordinate conversion, hidden targets, collision
and hover components, pause/reduced-motion physics, entry/exit/retry, target size,
text creation, media controls, and a simulated Sumi stroke.

Full Mac/VR parity is not established. Remaining gaps include standalone spatial
saving, several image/effect/transition equivalents, exact spatial audio
trim/seek/rate alignment, and live-stroke rendering. No physical-headset comfort
or performance result is claimed. Follow the separate headset acceptance protocol
before distribution. Preserve original projects while testing the preview.

This HTML/Markdown guide is the current spatial workflow reference. The Advanced
Engineer's Book retains its explicitly labeled August 24, 2026 architecture
baseline as a historical edition.

## About this edition

This is a text guide based on the current source and automated test results.
The illustrated walkthrough is pending; this edition contains no current UI
screenshots. A physical-headset acceptance session is still required.

For support, report the OS, development version, step, expected result, actual
result, and whether the issue occurs in a simulator or a physical headset. Avoid
including private projects or account information in a public report.
