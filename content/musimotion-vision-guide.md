---
title: "Musimotion 2D and volumetric presentation guide"
url: "/products/musimotion/vision-guide/"
draft: false
description: "Read 2D projects, animate solid 3D volumes, enter full immersion on Vision Pro, and render the same presentations on Mac and iPad."
---

[Back to Musimotion]({{< relref "musimotion.md" >}}) · [Product support]({{< relref "contact.md" >}})

Version 1.3 · November 19, 2026 · Development preview

Read existing **2D presentations**, switch to **3D Volume** for solid objects and
ink at different depths, and present inside **Full Immersion** on Vision Pro.
Mac and iPad render the same saved 3D project through a movable camera. The
illustrated sidebar, timeline and radial menus reuse the original iPad artwork;
none of those designer assets have been redrawn. To make a party scene, follow
the [birthday surprise walkthrough](#8-make-a-birthday-surprise).

This guide describes development source, not an App Store release. The Mac
1.0.0 build 7 approval is a separate release awaiting manual publication at the
November 19 check. These features require the updated development build on
each device. Keep a backup before opening a new 3D project in older software:
older builds do not understand the additional mode, camera and spatial ink data.

Images show actual application UI with synthetic demonstration content. Vision
Pro pictures are cropped frames from XCTest's simulator recording; companion
pictures identify their platform. Select an image to inspect it at full resolution. See [capture provenance]({{< asset-url "images/musimotion/visionos/provenance.json" >}}).
Simulator evidence does not establish physical headset comfort or hand tracking.

## 1. Read a 2D presentation

1. Use **Open** on Vision Pro, or your Mac/iPad document library, to select a
   `.musimotion` package. Existing documents without a saved mode open in **2D**.
2. Keep **2D** selected above the canvas. Use the original illustrated **File**,
   **Shapes**, **Images**, **Brushes**, **Effects**, **Text** and **Physics** controls.
3. Scrub the turquoise timeline, then press **Play/Pause**. Still paint, timed
   ink, imported media and layer animation retain their established 2D workflow.
4. On Vision Pro, **3D Setup** opens the optional spatial controls; **Artwork
   Editor** returns to the original editor. They edit the same project.

[![Original iPad artwork and turquoise timeline inside the Vision Pro editor]({{< asset-url "images/musimotion/visionos/original-artwork.webp" >}})]({{< asset-url "images/musimotion/visionos/original-artwork.webp" >}})

*Start in the familiar editor. Choosing a spatial workspace is optional.*

[![The same saved banner opened in 2D on Mac]({{< asset-url "images/musimotion/visionos/mac-2d.webp" >}})]({{< asset-url "images/musimotion/visionos/mac-2d.webp" >}})

*On Mac, 2D restores the flat canvas and original selection handles. Changing
mode preserves the saved depth information for later 3D playback.*

## 2. Make a banner cross the canvas in 3D

1. Choose **3D Volume** above the artwork canvas, then **Banner Exercise**.
   Alternatively, choose **3D Setup → Effects → Add Banner Exercise** on Vision
   Pro. Either action appends an eight-second scene and preserves existing scenes.
2. Select **Welcome Banner** using **Object** or the Layers list. Choose **Edit
   XYZ** and inspect the three supplied poses. Time is relative to this scene.
3. Tap a field or its label to edit, then choose **Save XYZ Keyframe**. Saving at an existing time
   replaces that pose. Scrub between the poses to see the interpolation.

| Scene time | X | Y | Z | Expected result |
| --- | --- | --- | --- | --- |
| 0 seconds | −0.30 | 0.30 | −0.80 | Starts left of the canvas, near the back of the volume |
| 2 seconds | 0.50 | 0.50 | −0.40 | Centred behind the canvas |
| 6 seconds | 0.50 | 0.50 | +0.40 | Centred in front of the canvas, closer to you |

[![Banner exercise in the spatial Effects panel]({{< asset-url "images/musimotion/visionos/banner-setup.webp" >}})]({{< asset-url "images/musimotion/visionos/banner-setup.webp" >}})

*The generated scene is synthetic test content. It is also the input to the
cross-platform depth, save/reopen and rendered-movie tests.*

[![Edit XYZ form with scene time and separate X, Y and Z fields]({{< asset-url "images/musimotion/visionos/xyz-keyframe.webp" >}})]({{< asset-url "images/musimotion/visionos/xyz-keyframe.webp" >}})

*X/Y 0–1 spans the reference canvas. Z=0 is the canvas plane; negative Z goes
behind it, positive Z comes out toward the front. Volume depth is −0.8…+0.8
in document space. A bounded window uniformly scales the entire volume to fit.*

4. In the window preview, choose **Viewpoint → Right side**, **Left side**,
   **Above** or **Rear** to inspect actual thickness and separation. **Front** and
   **Perspective** restore useful views; **Closer/Farther** adjust camera distance.
5. Choose **2D** to return to flat editing. Switching modes pauses playback and
   preserves the 3D coordinates, camera and ink. Choose **3D Volume** again to
   restore the spatial view. Spatial ink is visible in 3D mode.

[![iPad rendering of the shared volumetric presentation from a side viewpoint]({{< asset-url "images/musimotion/visionos/ipad-volume.webp" >}})]({{< asset-url "images/musimotion/visionos/ipad-volume.webp" >}})

*Mac and iPad use the same RealityKit scene construction as Vision Pro. Their
screen shows a camera view of the volume, and their selected viewpoint is saved.*

[![Mac editor rendering the animated 3D banner with the original controls]({{< asset-url "images/musimotion/visionos/mac-volume.webp" >}})]({{< asset-url "images/musimotion/visionos/mac-volume.webp" >}})

*The Mac can open, render, edit XYZ and export the same package without a headset.*

Invalid or out-of-range XYZ values keep the sheet open and explain the accepted
range. Correct the field or choose **Cancel**. Do not enter a new pose until the
intended object and scene time are selected.

[![Invalid XYZ value with a readable correction message on iPad]({{< asset-url "images/musimotion/visionos/xyz-recovery.webp" >}})]({{< asset-url "images/musimotion/visionos/xyz-recovery.webp" >}})

*Recovery: correct the depth to −0.8…+0.8 in 3D Volume, or cancel without saving.*

Download the [banner exercise]({{< asset-url "downloads/musimotion/visionos/MusimotionVR-Banner-Exercise.musimotion.zip" >}}),
unzip it, and open the enclosed `.musimotion` package. This is a project fixture,
not an app installer. Its [manifest]({{< asset-url "downloads/musimotion/visionos/manifest.json" >}}) records the archive checksum.

## 3. Open a bounded volume on Vision Pro

1. Choose **Open Volume**. The new window contains a real three-dimensional
   box: extruded text and solid shapes occupy its depth; images and video remain
   textured surfaces positioned in space. The centre rectangle marks Z=0.
2. Move the volume with the system window controls. View it from different sides
   to inspect depth. The volume scales uniformly instead of compressing Z.
3. Use its original turquoise transport to play and scrub. The controls float in
   a system ornament so shrinking the art volume does not shrink the buttons.
4. Choose **Close Volume** to return to the editor. Closing the volume pauses
   playback and disarms painting.

[![Bounded volume with the banner in front of the canvas and original timeline controls]({{< asset-url "images/musimotion/visionos/native-volume.webp" >}})]({{< asset-url "images/musimotion/visionos/native-volume.webp" >}})

*The wire box and canvas rectangle expose the depth relationship. The original
editor may remain behind the volume; move the system window if they overlap.*

The volume implements direct object dragging with a preserved grab offset and
writes the resulting XYZ pose at the playhead. **Direct headset gestures still
require device acceptance testing.** The visionOS 26.5 simulator exposes
placeholder entity coordinates and cannot reliably synthesize this interaction.
Use **Edit XYZ** for the automated, verified authoring route meanwhile.

## 4. Present in full immersion

1. Pause, select the intended scene/time, and choose **Full Immersion**.
2. The editor closes and your presentation occupies an immersive space. Its
   scene background surrounds the content. Full immersion is a deliberate
   choice; **Enter 3D** keeps the mixed surroundings and editor workflow.
3. Use the original floating transport above the content to play, pause and
   scrub. A presentation with multiple scenes plays them in timeline order.
4. Choose **Exit 3D**. Playback pauses, painting disarms, and one editor window
   reopens. If you leave with the system controls instead, reopen Musimotion
   from Home to continue editing.

[![Full immersive presentation with original artwork controls above the 3D content]({{< asset-url "images/musimotion/visionos/full-immersion.webp" >}})]({{< asset-url "images/musimotion/visionos/full-immersion.webp" >}})

*Full immersion removes the room passthrough. It does not turn the presentation
into a flat video: the banner and other solid objects retain their geometry.*

Start with short sessions and a stationary viewpoint. The app does not animate
your camera. Position content and controls for relaxed viewing, check the entire
animation path, and stop if uncomfortable. The sample is a test path, not a
personal comfort guarantee after moving/recentring the workspace.

## 5. Paint, save and replay Sumi ink

1. In **2D**, choose **File → Choose selected scene background → Rice Paper**.
   Close the background panel, then choose the original **Brushes** control.
2. Choose **Still Paint**, then **Sumi Round**, **Sumi Flat**, **Dry Sumi** or
   **Ink Wash**. Set the paint target, **Brush Size**, **Flow** and **Translucency**.
3. Close the panel and draw. The mode row stays pinned while other brush options
   scroll. On iPad, the 2D tools retain Pencil pressure/tilt behavior.

[![Rice Paper selected in the scene background panel]({{< asset-url "images/musimotion/visionos/paper-setup.webp" >}})]({{< asset-url "images/musimotion/visionos/paper-setup.webp" >}})

*Use a contrasting paper/ink combination. A dark stroke on a dark background
can be present but difficult to see.*

[![Still Paint and the Sumi preset controls in the original editor]({{< asset-url "images/musimotion/visionos/sumi-tools.webp" >}})]({{< asset-url "images/musimotion/visionos/sumi-tools.webp" >}})

*Choose the paint mode before the preset. The existing controls and artwork are shared.*

[![A committed Sumi mark on Rice Paper in the Vision Pro editor]({{< asset-url "images/musimotion/visionos/sumi-painted.webp" >}})]({{< asset-url "images/musimotion/visionos/sumi-painted.webp" >}})

*Release to commit the mark. Check the selected paint target and playhead when
troubleshooting missing ink; use undo for an unwanted mark.*

4. Choose **Live Paint** to record point timing. Draw, release, seek backward
   and press **Play** to reveal the stroke again. Recording stops at a scene
   boundary and retains the last sample. Slower capture uses **Paint Speed**.
5. The optional **3D Setup → Brushes** easel also offers **Record Live Ink** and
   **Recording speed**. Its saved stroke count confirms recorded data.

[![The spatial easel after recording a timed Sumi stroke]({{< asset-url "images/musimotion/visionos/live-sumi.webp" >}})]({{< asset-url "images/musimotion/visionos/live-sumi.webp" >}})

*Paper ink, saved raster assets and timed reveal use the shared Sumi engine
across Mac, iPad and Vision Pro. Entering a volume also renders these at Z=0.*

6. For **solid spatial ink**, switch to **3D Volume**, open **Brushes**, choose
   **Still Paint** or **Live Paint**, and set **Ink depth (Z)**. Drawing in the
   Mac/iPad camera preview places each point on that depth plane.
7. On Vision Pro, **Paint 3D Ink** arms the volume's drawing surface and exposes
   its depth slider. **Done Painting** returns to object manipulation. The
   physical hand gesture remains part of the device acceptance checklist.
8. **Eraser** removes a whole touched spatial stroke at the chosen depth; undo
   restores the gesture. **Clear 3D Ink** clears spatial strokes with undo.
   Saved spatial strokes retain XYZ and timing when reopened on another platform.

[![iPad camera preview with a saved stroke at a chosen depth]({{< asset-url "images/musimotion/visionos/ipad-depth-ink.webp" >}})]({{< asset-url "images/musimotion/visionos/ipad-depth-ink.webp" >}})

*3D ink is solid geometry. Paper absorption, Pencil dynamics and particle
recording belong to the 2D tools; they are not simulated as volumetric fluids.
Flow and translucency affect the spatial stroke opacity.*

## 6. Save, reopen and render on another device

1. On Vision Pro choose **Project → Save on Device** and check the saved status.
   Local edits also autosave after a short idle interval, including full immersion.
2. Choose **Project → Saved Presentations** to reopen from disk, or **Save a
   Copy…** for an independent title and project identity.
3. **Export Project…** writes a portable package with embedded media/paint and
   the mode, camera, XYZ keyframes and spatial strokes. Transfer it using your
   chosen file-sharing route, then open it in the updated Mac or iPad build.
4. **Export Video** renders the saved camera view for a 3D project and retains
   the original flat rendering path for a 2D project. A movie is a 2D view of
   the presentation; use the package for interactive spatial playback.

[![Saved Presentations library with the synthetic example project]({{< asset-url "images/musimotion/visionos/saved-library.webp" >}})]({{< asset-url "images/musimotion/visionos/saved-library.webp" >}})

*Local save is not cloud publication. Export may require the corresponding Pro
entitlement. A cancelled picker does not mean the file was saved; a save error
requires checking storage and preserving an exported copy before closing.*

## 7. Effects, media timing and evidence limits

Use **Artwork Editor** for the original effects and media controls. Select the
intended layer before applying masks, crop, blur, text style, opacity or transforms.
Shared rasterization keeps textured layers and exported movies consistent.
Blurred text/shapes use a textured surface so the effect remains visible; plain
text and shapes keep solid geometry. Images and video remain planar media.

Layer start time and source trim differ: a layer starting at 0.7 seconds with a
0.5-second source trim begins that source segment at scene time 0.7 seconds.
Seek, pause, rate and mute share a timing policy. Spatial playback suppresses
window audio to avoid duplicated tracks. The 3D renderer also includes scene
crossfades and background video surfaces. Celebration balloons have their own
collision simulation. Ordinary animated layers use the existing trajectory
model. Live video masks/blur and general-purpose spatial particle effects
remain limited. **Reduce motion** suppresses decorative
particles and physics motion while deliberate timeline animation remains available.

Automated tests exercise saved projects, real RealityKit frames, solid text
thickness, behind/front poses, camera views, Sumi reveal, masks/blur and movie
frames. Exported synthetic audio is decoded and checked within 80 ms. This does
not measure physical speaker latency, headset acoustics, sustained frame rate or
comfort. The [test report](https://github.com/RudyAramayo/Musimotion/blob/main/docs/INITIAL_TESTING.md) records exact runs and the
explicit simulator gesture limitation. The [headset checklist]({{< relref "musimotion-headset-testing.md" >}})
remains the acceptance gate for hands, gaze, repeated grabs and longer sessions.

## 8. Make a birthday surprise

Select any picture below to enlarge the controls.

1. Open the artwork editor and choose **Celebration** above the canvas or from
   the original **Effects** side tab. Choose
   **Add Birthday Surprise** to append a 16-second scene. It opens in **3D Volume**.
   The first three seconds count down from three. At three seconds, the gold
   **Happy Birthday!** greeting moves forward as balloons and confetti begin to
   fall. Fireworks start two seconds after the effects cue.

   [![Mac Celebration Effects sheet with Add Birthday Surprise, Add Balloon Drop and Add Fireworks]({{< asset-url "images/musimotion/visionos/birthday-01.webp" >}})]({{< asset-url "images/musimotion/visionos/birthday-01.webp" >}})

   *Mac. Add a complete scene or apply one effect to the selected scene.*

2. To decorate a scene you already have, select that scene first, choose
   **Celebration**, then **Add Balloon Drop** or **Add Fireworks**. Turn
   **Balloon Drop**, **Fireworks** and **Confetti** on or off independently.
   **Remove Effects** clears these decorations. The countdown and greeting are
   editable text layers and can be selected or removed separately.

   [![The Celebration Effects settings on Vision Pro Simulator]({{< asset-url "images/musimotion/visionos/birthday-vision-controls.webp" >}})]({{< asset-url "images/musimotion/visionos/birthday-vision-controls.webp" >}})

   *Vision Pro Simulator. The same scene settings are available in the artwork editor.*

3. Use **Balloons** to choose 8–64 balloons. **Fall speed** changes how quickly
   they accelerate, **Wind** changes sideways drift, and **Bounce** controls how
   much speed they retain on contact. **Effects start** is measured from the
   beginning of the scene. Set it before the end of the scene so there is time
   to see the effects. Changing this cue leaves your text layer timing intact.

   [![Mac birthday settings with balloon, firework and confetti controls]({{< asset-url "images/musimotion/visionos/birthday-02.webp" >}})]({{< asset-url "images/musimotion/visionos/birthday-02.webp" >}})

   *Mac. The switches control the decorations separately. Timing and physics belong to this scene.*

4. Choose **Show Burst** to pause on the first firework, just under three
   seconds after the effects cue. Choose **Preview Surprise** to play from the
   start of the scene. Both preview buttons return a 2D view to **3D Volume**.
   If **Show Burst** is dimmed, enable **Fireworks** and place the effects cue
   at least three seconds before the end of the scene. Pause with the turquoise
   transport. On Mac or iPad, choose **Viewpoint → Celebration close-up** to
   frame the party. Choose **Right side** or **Rear** to see the spacing between
   balloons. Save the project to keep the editable effects.
   **Export Video** renders a movie from the saved camera using a stationary
   reference viewer for balloon contact.

   [![The birthday scene in the Mac 3D camera preview]({{< asset-url "images/musimotion/visionos/birthday-03.webp" >}})]({{< asset-url "images/musimotion/visionos/birthday-03.webp" >}})

   *Mac. The saved camera frames the celebration for playback and movie export.*


   [![iPad Simulator 3D camera preview of the birthday greeting, balloons and fireworks above the turquoise controls]({{< asset-url "images/musimotion/visionos/ipad-birthday-03.webp" >}})]({{< asset-url "images/musimotion/visionos/ipad-birthday-03.webp" >}})

   *iPad Simulator. The same scene can be played and scrubbed from the original iPad transport.*


   [![Vision Pro Simulator showing the birthday scene in a bounded volume with the original transport]({{< asset-url "images/musimotion/visionos/birthday-vision-volume.webp" >}})]({{< asset-url "images/musimotion/visionos/birthday-vision-volume.webp" >}})

   *Vision Pro Simulator. Open Volume presents the party in miniature.*

5. On Vision Pro, pause and rewind the birthday scene, choose **Full Immersion**,
   then press **Play/Pause**. Look up and around as balloons descend from
   overhead, collide with one another, glance off a virtual envelope around
   the viewer and settle at a virtual floor. The display reports **Viewer
   contact active** when device tracking is available. Musimotion uses the
   current headset position in memory and keeps the arena at its initial
   location. Balloons crossing your line of sight to the birthday greeting
   turn translucent while it is visible. Balloon contact is visual.

   [![Birthday greeting, balloon drop and firework burst in Vision Pro Simulator full immersion]({{< asset-url "images/musimotion/visionos/birthday-vision-immersion.webp" >}})]({{< asset-url "images/musimotion/visionos/birthday-vision-immersion.webp" >}})

   *Vision Pro Simulator. In Full Immersion, a balloon in front of the gold greeting turns translucent while the rest of the drop remains visible.*

6. If live tracking is unavailable, the presentation uses a reference viewer.
   To check the effect from a fixed position, use the 3D preview or export a
   movie. For a quieter presentation, enable **Reduce motion** in 3D Setup or
   the system **Reduce Motion** setting. The balloons form a still arrangement
   and the greeting plays without fireworks or confetti. **Exit 3D** returns to the editor.

To try the same scene used in the package test, download the
[birthday presentation]({{< asset-url "downloads/musimotion/visionos/MusimotionVR-Birthday-Surprise.musimotion.zip" >}}),
unzip it, and open the enclosed project on Mac, iPad or Vision Pro.
The [sample manifest]({{< asset-url "downloads/musimotion/visionos/birthday-manifest.json" >}}) records its size,
checksum and source test.

## AI, sharing and support

**AI Create** uses Apple's on-device Foundation Models framework when available,
with an editable deterministic fallback. Availability depends on device, OS,
language and region; it does not establish China distribution compliance. Image
Playground has separate requirements. Tests use fixtures rather than a model response.

File import uses the system picker. Local saving does not publish the project.
**Share**, **Live Together**, **Send Clip**, **Invite People** and **Community**
can send project data, media or rendered clips to other people and Apple CloudKit.
Public community posts and unlisted links have different visibility. Fixture
checks do not establish live SharePlay, delivery or production account permissions.

For support, include OS, development revision, exact steps, expected/actual
result and whether you used a simulator or physical device. Keep private project
content and account details out of public reports. The Advanced Engineer's Book
retains its labelled August 24, 2026 baseline; this guide describes the new workflow.
