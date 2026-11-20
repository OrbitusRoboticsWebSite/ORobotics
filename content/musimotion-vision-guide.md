---
title: "Musimotion 2D and volumetric presentation guide"
url: "/products/musimotion/vision-guide/"
draft: false
description: "Read 2D projects, select and edit objects in 3D, open or import scene templates, create immersive scenes on Vision Pro and generate your own soundtrack."
---

[Back to Musimotion]({{< relref "musimotion.md" >}}) · [Product support]({{< relref "contact.md" >}})

Version 1.8 · November 19, 2026 · Development preview

Read existing **2D presentations**, switch to **3D Volume** for solid objects and
ink at different depths, and present inside **Full Immersion** on Vision Pro.
Mac and iPad render the same saved 3D project through a movable camera. The
illustrated sidebar, timeline and radial menus reuse the original iPad artwork;
none of those designer assets have been redrawn. To make a party scene, follow
the [birthday surprise walkthrough](#8-make-a-birthday-surprise). To build a music game,
follow [Create a rhythm scene](#9-create-a-rhythm-scene). You can also
[generate a soundtrack](#10-generate-a-soundtrack) for a 2D or spatial scene,
or [play Droid Arena](#11-play-droid-arena) in Full Immersion. For brush technique, see [Paint, save and replay Sumi ink](#5-paint-save-and-replay-sumi-ink). For a project
you are editing, see [Select, edit and copy objects](#12-select-edit-and-copy-objects).

This guide describes development source, not an App Store release. The Mac
1.0.0 build 7 approval is a separate release awaiting manual publication at the
November 19 check. These features require the updated development build on
each device. Keep a backup before opening a new 3D project in older software:
older builds do not understand the additional mode, camera and spatial ink data.

Images show actual application UI with demonstration content. The Vision Pro
pictures come from simulator recordings and direct simulator screenshots. Other captures identify their
platform. Select any picture to see its full size. [Capture provenance]({{< asset-url "images/musimotion/visionos/provenance.json" >}})
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

{{< musimotion-capture "editor-controls/timeline-tracks.webp" "Open layer tracks above the transport and full-width scrubber" >}}

*The icon at the far right of the transport row opens or closes the tracks. See the [illustrated editor controls guide]({{< relref "musimotion-editor-controls.md" >}}) for moving objects, using the wheel and applying effects.*

{{< musimotion-capture "original-artwork.webp" "Original iPad artwork and turquoise timeline inside the Vision Pro editor" >}}

*Start in the familiar editor. Choosing a spatial workspace is optional.*

{{< musimotion-capture "mac-2d.webp" "The same saved banner opened in 2D on Mac" >}}

*On Mac, 2D restores the flat canvas and original selection handles. Changing
mode preserves the saved depth information for later 3D playback.*

## 2. Make a banner cross the canvas in 3D

1. Choose **Templates → Welcome Banner → Import into Presentation**. On Vision
   Pro you can also open **Project → Templates**. Import appends an editable
   eight-second scene. To start a separate project, choose **Open as New Presentation**.

   {{< musimotion-capture "editor-mac-welcome-template.webp" "Mac Templates browser with Welcome Banner selected above Open as New Presentation and Import into Presentation" >}}

   *Mac. Import adds this banner scene after the existing scenes. Open creates a separate document in the library.*

2. Click a visible letter of **Welcome Banner**, or select it in **Objects**. Choose **Edit
   XYZ** and inspect the three supplied poses. Time is relative to this scene.
3. Tap a field or its label to edit, then choose **Save XYZ Keyframe**. Saving at an existing time
   replaces that pose. Scrub between the poses to see the interpolation.

| Scene time | X | Y | Z | Expected result |
| --- | --- | --- | --- | --- |
| 0 seconds | −0.30 | 0.30 | −0.80 | Starts left of the canvas, near the back of the volume |
| 2 seconds | 0.50 | 0.50 | −0.40 | Centred behind the canvas |
| 6 seconds | 0.50 | 0.50 | +0.40 | Centred in front of the canvas, closer to you |

{{< musimotion-capture "banner-setup.webp" "Banner exercise in the spatial Effects panel" >}}

*Earlier development capture of the synthetic banner. Use **Templates** in the current editor. It is also the input to the
cross-platform depth, save/reopen and rendered-movie tests.*

{{< musimotion-capture "xyz-keyframe.webp" "Edit XYZ form with scene time and separate X, Y and Z fields" >}}

*X/Y 0–1 spans the reference canvas. Z=0 is the canvas plane; negative Z goes
behind it, positive Z comes out toward the front. Volume depth is −0.8…+0.8
in document space. A bounded window uniformly scales the entire volume to fit.*

4. In the window preview, choose **Viewpoint → Right side**, **Left side**,
   **Above** or **Rear** to inspect actual thickness and separation. **Front** and
   **Perspective** restore useful views; **Closer/Farther** adjust camera distance.
5. Choose **2D** to return to flat editing. Switching modes pauses playback and
   preserves the 3D coordinates, camera and ink. Choose **3D Volume** again to
   restore the spatial view. Spatial ink is visible in 3D mode.

{{< musimotion-capture "ipad-volume.webp" "iPad rendering of the shared volumetric presentation from a side viewpoint" >}}

*Mac and iPad use the same RealityKit scene construction as Vision Pro. Their
screen shows a camera view of the volume, and their selected viewpoint is saved.*

{{< musimotion-capture "mac-volume.webp" "Mac editor rendering the animated 3D banner with the original controls" >}}

*The Mac can open, render, edit XYZ and export the same package without a headset.*

Invalid or out-of-range XYZ values keep the sheet open and explain the accepted
range. Correct the field or choose **Cancel**. Do not enter a new pose until the
intended object and scene time are selected.

{{< musimotion-capture "xyz-recovery.webp" "Invalid XYZ value with a readable correction message on iPad" >}}

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

{{< musimotion-capture "native-volume.webp" "Bounded volume with the banner in front of the canvas and original timeline controls" >}}

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

{{< musimotion-capture "full-immersion.webp" "Full immersive presentation with original artwork controls above the 3D content" >}}

*Full immersion removes the room passthrough. It does not turn the presentation
into a flat video: the banner and other solid objects retain their geometry.*

Start with short sessions and a stationary viewpoint. The app does not animate
your camera. Position content and controls for relaxed viewing, check the entire
animation path, and stop if uncomfortable. The sample is a test path, not a
personal comfort guarantee after moving/recentring the workspace.

## 5. Paint, save and replay Sumi ink

1. In **2D**, open **Brushes** and choose **Still Paint** for a permanent mark or **Live Paint** to record how it was drawn. Choose a Sumi nib. In the brush panel, open **Background** and select **Rice Paper**. Close the background panel to return to the scene.

{{< musimotion-capture "paper-setup.webp" "Rice Paper selected in the scene background panel" >}}

*The paper and ink need enough contrast to see a pale wash. Use a light sheet and a dark ink color for this exercise.*

2. Start with **Ink Wash**. Leave **Water** near its wet end and **Ink Load** around one third. Make a broad stroke for the distant stalk. Cross it with a second stroke to see the gray deepen where the marks overlap.

{{< musimotion-capture "sumi-mixture.webp" "Mac brush panel showing Ink Wash, Water and Ink Load" >}}

*Water changes the reach of the feathered edge. Ink Load changes the amount of pigment. Translucency controls how much of the sheet or an earlier stroke shows through.*

3. Switch to **Sumi Round** for a leaf. Start lightly, press through the middle and lift toward the tip. With a Mac pointer or a finger, slow down for a fuller mark and flick to lift. Try **Sumi Flat** for the stalk joints, then use **Dry Sumi** with low Water on **Rough Fiber** to leave streaks of bare paper. Each nib remembers its mix while you switch between them.

{{< musimotion-capture "sumi-bamboo.webp" "Bamboo painted on Rice Paper with a pale stalk behind darker, tapered leaves" >}}

*This synthetic study uses 65 timed strokes. [Download the editable bamboo study]({{< asset-url "downloads/musimotion/visionos/Musimotion-Bamboo-Study.musimotion.zip" >}}), unzip it, and open the .musimotion document in the development editor. Choose **Go to End** for the finished painting, or **Go to Start** and **Play** to watch the strokes appear. [Watch the four-second movie exported from this study]({{< asset-url "downloads/musimotion/visionos/Bamboo-on-Rice-Paper.mp4" >}}).*

{{< musimotion-capture "sumi-brush-comparison.webp" "Matched brush strokes from the earlier and updated renderer. Four rows show a round mark, flat mark, dry bristles and diluted wash." >}}

*Identical recorded gestures in each column. From top to bottom, compare Sumi Round, Sumi Flat, Dry Sumi and Ink Wash. Look for the feathered edge of the wash and the slivers of paper in the dry stroke.*

4. In **Live Paint**, draw, release and scrub backward. Press **Play** to reveal your marks again. Use **Objects** to edit a recorded stroke’s Water or Ink Load. Choose **Still Paint** when you want ink baked into the selected paint layer. Change the paper before painting the still layer. Previously baked pixels keep their original appearance. Earlier Live Paint strokes replay with the updated nib and its default Water setting. The feathered edge appears as you paint and stays in place after you lift the brush.

{{< musimotion-capture "sumi-editor.webp" "Completed bamboo project open in the Mac editor with its timeline" >}}

*If the opened study looks blank, use **Go to End**. A Live Paint stroke first appears at its recorded time. For a new mark, also check the selected paint target and ink color. Undo removes an unwanted stroke.*

5. The optional **3D Setup → Brushes** easel also offers **Record Live Ink** and
   **Recording speed**. Its saved stroke count confirms recorded data.

{{< musimotion-capture "live-sumi.webp" "The spatial easel after recording a timed Sumi stroke" >}}

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

{{< musimotion-capture "ipad-depth-ink.webp" "iPad camera preview with a saved stroke at a chosen depth" >}}

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

{{< musimotion-capture "saved-library.webp" "Saved Presentations library with the synthetic example project" >}}

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

1. Choose **Templates → Birthday Surprise → Import into Presentation** to add a 16-second scene. It opens in **3D Volume**.
   The first three seconds count down from three. At three seconds, the gold
   **Happy Birthday!** greeting moves forward as balloons and confetti begin to
   fall. Fireworks start two seconds after the effects cue.

   {{< musimotion-capture "birthday-01.webp" "Mac Celebration Effects sheet with Add Birthday Surprise, Add Balloon Drop and Add Fireworks" >}}

   *Earlier Mac development capture of the effects controls. The current editor opens the complete birthday scene from Templates.*

2. To decorate a scene you already have, select that scene first, choose
   **Effects → Celebration**, then **Add Balloon Drop** or **Add Fireworks**. Turn
   **Balloon Drop**, **Fireworks** and **Confetti** on or off independently.
   **Remove Effects** clears these decorations. The countdown and greeting are
   editable text layers and can be selected or removed separately.

   {{< musimotion-capture "birthday-vision-controls.webp" "The Celebration Effects settings on Vision Pro Simulator" >}}

   *Vision Pro Simulator. The same scene settings are available in the artwork editor.*

3. Use **Balloons** to choose 8–64 balloons. **Fall speed** changes how quickly
   they accelerate, **Wind** changes sideways drift, and **Bounce** controls how
   much speed they retain on contact. **Effects start** is measured from the
   beginning of the scene. Set it before the end of the scene so there is time
   to see the effects. Changing this cue leaves your text layer timing intact.

   {{< musimotion-capture "birthday-02.webp" "Mac birthday settings with balloon, firework and confetti controls" >}}

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

   {{< musimotion-capture "birthday-03.webp" "The birthday scene in the Mac 3D camera preview" >}}

   *Mac. The saved camera frames the celebration for playback and movie export.*


   {{< musimotion-capture "ipad-birthday-03.webp" "iPad Simulator 3D camera preview of the birthday greeting, balloons and fireworks above the turquoise controls" >}}

   *iPad Simulator. The same scene can be played and scrubbed from the original iPad transport.*


   {{< musimotion-capture "birthday-vision-volume.webp" "Vision Pro Simulator showing the birthday scene in a bounded volume with the original transport" >}}

   *Vision Pro Simulator. Open Volume presents the party in miniature.*

5. On Vision Pro, pause and rewind the birthday scene, choose **Full Immersion**,
   then press **Play/Pause**. Look up and around as balloons descend from
   overhead, collide with one another, glance off a virtual envelope around
   the viewer and settle at a virtual floor. The display reports **Viewer
   contact active** when device tracking is available. Musimotion uses the
   current headset position in memory and keeps the arena at its initial
   location. Balloons crossing your line of sight to the birthday greeting
   turn translucent while it is visible. Balloon contact is visual.

   {{< musimotion-capture "birthday-vision-immersion.webp" "Birthday greeting, balloon drop and firework burst in Vision Pro Simulator full immersion" >}}

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

## 9. Create a rhythm scene

1. Open the artwork editor and choose **Templates → Rhythm Stage → Import into Presentation**.
   The new scene starts with *Orbit Pulse*, an eight-bar House arrangement at 120 BPM. The
   two-second lead-in gives the first shape time to approach. The song then
   plays for 16 seconds, with 32 targets on the default chart.

   {{< musimotion-capture "rhythm-vision-add.webp" "Rhythm Studio on Vision Pro Simulator with Add Rhythm Scene over the original illustrated editor" >}}

   *Earlier Vision Pro Simulator capture of the rhythm starter. In the current editor, import Rhythm Stage from Templates.*

2. For a different soundtrack, choose **Objects → Rhythm Settings… → Song → Generate Music…**. Choose a style and ensemble, generate a take, and listen with **Preview**. **Use as Rhythm Song** puts that performance in the scene and builds a chart from its musical accents. Undo restores the previous song and chart. For instrument choices and audio examples, see [Generate a soundtrack](#10-generate-a-soundtrack).

   {{< musimotion-capture "music-rhythm-song.webp" "Rhythm Studio Song tab shows Orbit Pulse, Generate Music and its seven instruments" >}}

   *Mac development editor. The starter has 32 practice targets. Electric piano, guitar, bass and percussion play around that steady practice beat.*

   To import a recording instead, choose **Choose Song…** on the **Song** tab.
   Pick a local audio file between half a second and 30 minutes long, up to
   128 MB. Musimotion measures rhythmic accents on the device and embeds the
   audio in the project. If you hear an accent where a target should arrive,
   use **Timing adjustment** to move the chart up to half a second earlier
   or later. This keeps your edits to individual targets.

   For a song with a steady tempo or no detected beats, enter its **Tempo
   (BPM)** and **First beat (song seconds)**, then choose **Apply Beat Grid**.
   For example, enter 120 and 0.35 if the first beat occurs 0.35 seconds into
   a 120 BPM recording. **Use Detected Beats** restores the analyzed accents
   when available. Replacing the song or changing the underlying beat grid
   clears per-target edits, so settle the timing before designing the chart.

   {{< musimotion-capture "mac-rhythm-06.webp" "Mac Rhythm Studio Song tab showing the title and analyzed target count for Studio rhythm demo" >}}

   *Mac. The synthetic recording has finished importing. The title and target count identify the new chart.*

3. Open **Chart**. Use **Target density** to choose **Every beat** or **Every
   other beat**. **Approach time** controls how long you can see the target
   before it arrives. Select a target with **Previous**, **Next** or the
   slider. Set its **Hand** (left or right), **Lane** (inner or outer) and
   **Shape** (cube, orb or diamond). Use **Reset This Target** to restore
   its generated settings.

   {{< musimotion-capture "mac-rhythm-03.webp" "Mac Chart tab showing Target 2, its arrival time and the controls for hand, lane and shape" >}}

   *Mac. Use Previous or Next to choose which target to edit.*

   **Preview Beat** closes the sheet and pauses the 3D view at the selected
   target's arrival. **Play Song** plays from the start of the scene.
   On Mac or iPad, use the original transport to pause or seek.

   {{< musimotion-capture "ipad-rhythm-05.webp" "iPad Simulator with colored targets in the 3D camera preview above the original turquoise transport" >}}

   *iPad Simulator. Preview Beat pauses the chart at the arrival time of the selected target.*

4. Open **Panorama** and select **Aurora**, **Sunset** or **Midnight**.
   To use your own scene, choose **Import Panorama…** and select a wide
   2:1 equirectangular image. The app embeds it in the presentation.
   **Use Theme Instead** returns to the built-in environment. The bounded
   volume frames the approach from the front. Mac and iPad place the camera
   inside the panorama. In Full Immersion the panorama wraps behind you as well.

   {{< musimotion-capture "rhythm-vision-panorama.webp" "Vision Pro Simulator showing the three panorama themes and the Import Panorama button" >}}

   *Vision Pro Simulator. Select a theme or import a 2:1 image to surround the lane.*

   {{< musimotion-capture "mac-rhythm-07.webp" "Mac Rhythm Studio displaying the recovery message after importing a square panorama" >}}

   *Mac. A square image triggers the aspect-ratio message. Use Import Panorama again to choose an equirectangular image.*

5. On Vision Pro, face the direction you want the targets to approach from,
   open **Full Immersion** and choose **Play with Hands**. Allow hand tracking
   and hold both hands comfortably in view. Sweep the cyan left saber through a single-striped cyan
   target as it arrives. Use the coral right saber for double-striped coral
   targets. A successful cut splits the shape and adds one to **Hits**. Keep your feet in place as you follow the incoming shapes.

   {{< musimotion-capture "rhythm-vision-immersion.webp" "Cyan and coral targets in front of a starry mountain panorama with Play with Hands and Preview Music above the lane" >}}

   *Vision Pro Simulator. A single stripe marks left targets. Two stripes mark right targets. The controls offer hand play and music preview.*

   If hand access is off or unavailable, choose **Preview Music** to hear
   the song and watch the chart. To resume after tracking loss, return your
   hands to view and choose **Play with Hands**. Enable **Reduce motion** to omit the split animation.
   Targets still approach on the beat, and the panorama stays fixed. **Pause** interrupts the round. **Restart Round**
   resets the playhead and score. **Exit 3D** returns to the editor. Tracked
   poses are used during play and are kept in memory.

   {{< musimotion-capture "rhythm-vision-preview.webp" "Vision Pro Simulator music preview showing three targets in the lane, with a coral diamond in front of two distant targets" >}}

   *Vision Pro Simulator. Preview Music plays the song and target sequence. Hits stays at zero during preview.*

   {{< musimotion-capture "rhythm-vision-recovery.webp" "A message above the immersive stage says hand tracking is unavailable here and offers Preview Music" >}}

   *Vision Pro Simulator. The fallback gives you a way to play the song when the headset cannot supply hand tracking.*

6. Save the presentation and open it in a matching development build on
   Mac, iPad or Vision Pro. The project contains the audio, editable chart
   and any imported panorama. **Export Video** renders the authored sequence
   and music from the saved viewpoint. Live hand poses and hit scores belong
   to the current round.

Download the [original Orbit Pulse sample]({{< asset-url "downloads/musimotion/visionos/MusimotionVR-Orbit-Pulse.musimotion.zip" >}})
to try the earlier chart with its original embedded recording. Import a fresh Rhythm Stage in the updated editor to hear the new arrangement. Unzip the download and open the
enclosed `.musimotion` project. The [sample manifest]({{< asset-url "downloads/musimotion/visionos/rhythm-manifest.json" >}})
lists the download size and the checksums for the archive, presentation and
embedded song.

[Play the 18-second Orbit Pulse movie with sound]({{< asset-url "downloads/musimotion/visionos/Orbit-Pulse-Rhythm-Stage.mp4" >}})
(1.85 MB). This camera-view export starts with a still mountain horizon.
The first cyan cube reaches the lane marker as the music begins at two
seconds. Cyan and coral shapes alternate with the beat for the rest of the song.

## 10. Generate a soundtrack

1. Select the scene that needs music and move its playhead to the point where
   the track should start. Choose **Music Studio** above the canvas in the
   artwork editor. In the Vision Pro spatial workspace, choose **Add Media →
   Music Studio**. You can score a still title card, an animation or a volumetric scene.

2. Choose **Techno**, **House**, **Breakbeat**, **Ambient** or **Retro 8-bit**. For the first four styles, open **Ensemble**. **Auto** lets the composer pick a lineup for the take. Choose **Electronic**, **Studio Band** or **Chamber** to set the instrument family yourself. **Retro 8-bit** uses its own chip instruments. Set the tempo (60–180 BPM)
   and the length (2, 4, 8 or 16 bars). For a short techno cue, try 132 BPM, four bars and
   the description “driving kick, bright hats and a pulsing bass.” Four bars
   of four beats at that tempo last about 7.27 seconds.

   {{< musimotion-capture "ipad-music-01.webp" "Music Studio on iPad with Techno selected, 132 BPM, four bars and the Local Pattern Model composer" >}}

   *Earlier iPad simulator capture of the style, tempo and length controls. Choose Local Pattern Model in the Composer menu to generate offline.*

3. Choose **Generate Music**. With **Automatic**, Music Studio asks Apple's
   on-device Foundation Models framework to plan the arrangement when the
   system model is available. The **Local Pattern Model** samples note transitions
   learned from original musical phrases and works on devices without Apple
   Intelligence. Musimotion synthesizes the instruments on your device. Check the composer
   name under the generated title. If Apple’s model is unavailable or cannot
   finish, the take identifies the **Local Pattern Model**. The description
   stays on the device.

   {{< musimotion-capture "mac-music-04.webp" "Mac Music Studio result with Apple Foundation Models credited below Variation 39077, at 132 BPM and 7.3 seconds" >}}

   *Mac. This take credits Apple Foundation Models in the result area. Preview auditions the take before you add it.*

4. Listen with **Preview**. Choose **New Variation** to try another take with
   your settings. Select **Add to Scene** when you like the result. The audio
   starts at the current playhead. A take that extends past the scene's end
   lengthens the scene so you can hear the ending.

   {{< musimotion-capture "music-ensemble-preview.webp" "Music Studio showing the House style, Studio Band ensemble and the instrument lineup for a generated take" >}}

   *Mac development editor. The instrument list describes this take. Preview plays it, and New Variation composes another performance with the current settings.*

   Changing a setting clears the current preview. Add a take you want to keep
   before trying another setting.

   {{< musimotion-capture "droid-vision-generated-music.webp" "Music Studio in the Vision Pro artwork editor with a generated two-bar techno take and the Preview, Add to Scene and Score Presentation controls" >}}

   *Vision Pro simulator. Midnight Orbit credits the Local Pattern Model. Preview, Add to Scene and Score Presentation sit below the result.*

5. For one continuous soundtrack, choose **Score Presentation**. Musimotion
   repeats the take across scene boundaries and preserves the duration of
   each scene. On a Rhythm Studio scene, **Use as Rhythm Song** replaces
   the song and places targets on accents from the new arrangement. Review the chart afterward
   to make any individual target edits for the new music.

   {{< musimotion-capture "music-ensemble-retro.webp" "Rhythm Studio after applying a Retro 8-bit song, with chip pulse, chip triangle and chip noise listed above Song beats" >}}

   *Mac development editor. After Use as Rhythm Song, the Song tab shows the new instruments and the editable target count. Leaving the generator with Done keeps the song you already have.*

   {{< musimotion-capture "mac-music-05.webp" "Mac timeline showing two adjoining orange audio layers, covering the whole ten-second scene" >}}

   *Mac. Score Presentation repeats a short take to reach the end of a ten-second scene. The second audio layer starts where the first one ends.*

6. Play the presentation from before the insert point. The generated music is
   a regular audio layer that you can move, trim or mute. Save the project to
   carry its audio to another device with the updated build. **Export Video**
   includes the music in the presentation's sound mix. The App Clip plays
   shared presentations. Music Studio lives in the full presentation editors.

   {{< musimotion-capture "ipad-music-03.webp" "iPad 2D timeline with the new Midnight Drift audio layer beneath the welcome title and orb" >}}

   *iPad simulator. The generated music is selected in the ordinary 2D timeline. Its bar shows where the take begins and ends.*

### Compare the ensembles

These three on-device recordings each last eight seconds at 120 BPM. The House and Retro examples use the same variation seed so you can hear how the style changes the sound.

**House · Studio Band** pairs drawbar organ, electric bass and vibraphone with handclaps, shaker and congas.

<audio controls preload="none" style="width:100%;max-width:32rem" aria-label="House · Studio Band, eight seconds at 120 BPM" src='{{< asset-url "downloads/musimotion/visionos/Musimotion-house-studio-band.flac" >}}'></audio>

[Download House · Studio Band FLAC]({{< asset-url "downloads/musimotion/visionos/Musimotion-house-studio-band.flac" >}})

**Ambient · Chamber** pairs bowed strings, vibraphone and upright bass with frame drum and shaker.

<audio controls preload="none" style="width:100%;max-width:32rem" aria-label="Ambient · Chamber, eight seconds at 120 BPM" src='{{< asset-url "downloads/musimotion/visionos/Musimotion-ambient-chamber.flac" >}}'></audio>

[Download Ambient · Chamber FLAC]({{< asset-url "downloads/musimotion/visionos/Musimotion-ambient-chamber.flac" >}})

**Retro 8-bit** uses chip pulse, triangle and noise voices for the arcade sound.

<audio controls preload="none" style="width:100%;max-width:32rem" aria-label="Retro 8-bit, eight seconds at 120 BPM" src='{{< asset-url "downloads/musimotion/visionos/Musimotion-retro-8bit.flac" >}}'></audio>

[Download Retro 8-bit FLAC]({{< asset-url "downloads/musimotion/visionos/Musimotion-retro-8bit.flac" >}})


The [audio example manifest]({{< asset-url "downloads/musimotion/visionos/music-ensemble-examples.json" >}}) lists the instruments, variation seed and checksums for the lossless FLAC and original WAV for each performance.

<audio controls preload="none" aria-label="Warehouse Techno, a four-bar 132 BPM generated soundtrack" src='{{< asset-url "downloads/musimotion/visionos/Musimotion-Techno-Session.wav" >}}'></audio>

[Download the earlier Warehouse Techno example]({{< asset-url "downloads/musimotion/visionos/Musimotion-Techno-Session.wav" >}}) (7.27 s,
931 KB). Apple Foundation Models composed this particular four-bar take at
132 BPM on the test Mac. Musimotion rendered its drums, bass and lead into
the stereo WAV. The direction was “Driving warehouse techno with deep bass,
bright open hats and a melodic metallic hook.”

## 11. Play Droid Arena

1. On Vision Pro, choose **Project → Templates → Droid Arena → Import into Presentation**. This adds a
   new 42-second scene. Select **Full Immersion** to stand inside the arena.
   Each of its three waves lasts 14 seconds. Look for an energized droid as
   it prepares to release a glowing pulse.

   {{< musimotion-capture "droid-vision-arena-menu.webp" "Vision Pro simulator Project menu with Add Droid Arena above Save on Device" >}}

   *Earlier Vision Pro Simulator capture of the Project menu. In the current editor, Project opens Templates. Full Immersion remains above the stage.*

2. Start with **Preview Waves** to see the formations and the incoming pulses
   before playing. The first wave has three droids, the second has four
   and the third has five. They follow circular patrols, sweep sideways
   or hover. Learn the single pulse in wave one. In wave two, a scout
   sends two pulses in quick succession and darts sideways. A guard's
   violet shield spins around its eye and opens briefly as it fires.
   Time your pulse to reach the exposed eye. In wave three, a heavy
   droid can send five pulses at once in a widening fan.

   {{< musimotion-capture "droid-vision-orbital-dock.webp" "Three floating droids over a gridded dock beside a ringed planet, with Play with Hands and Preview Waves controls" >}}

   *Vision Pro simulator. The first wave opens with three droids and three energy points. Select Preview Waves to watch the formation.*

   {{< musimotion-capture "droid-vision-guard-wave.webp" "Four hovering droids in wave two, with a violet shield covering the eye of the guard in the middle" >}}

   *Vision Pro simulator. The guard in the middle has its violet shield closed. The wave-two prompt explains when to watch for the opening.*

3. Choose **Play with Hands** and allow hand tracking when prompted. Keep both
   hands comfortably in view. A pulse tool follows your right hand. Point it
   at a droid and pinch once, then release your fingers before the next
   pulse. Watch the hit count when a droid disappears.

4. To draw the shield, bring your left hand beside and slightly behind your
   left shoulder, then bring it forward. The shield follows that hand. Move
   it into an approaching pulse's path to register a block. A pulse follows
   the course it had when it left the droid. Repeat the
   shoulder action to stow it. Use **Raise Shield** or **Stow Shield** to
   change the equipped tool within sight if the headset loses sight of
   your hand near the shoulder.

   {{< musimotion-capture "droid-vision-shield-preview.webp" "Translucent cyan shield raised over the dock in Preview Waves, with Stow Shield visible" >}}

   *Vision Pro simulator. Raise Shield displays the shield in a reference position during preview. Live play attaches it to your tracked left hand.*

5. Watch the wave, hits, blocks and remaining energy. Use **Pause** to take a
   break. If the right hand leaves view, tracking pauses. Bring it back and
   choose **Play with Hands** to resume. If the left hand leaves view, bring
   it back to place the shield. **Preview Waves** remains available if tracked
   play cannot start. **Restart** starts another round. **Exit 3D** returns
   to the editor.

   {{< musimotion-capture "droid-vision-tracking-recovery.webp" "Tracking unavailable message above the arcade dock with Preview Waves available" >}}

   *Vision Pro simulator. If hand tracking is unavailable, Preview Waves plays the sequence with scoring off.*

6. For a quieter scene, enable **Reduce motion** in **3D Setup** or **Reduce Motion**
   in system accessibility settings. Droids then hold their positions.
   A guard's shield stops spinning and still opens at its firing cue.
   Incoming pulses and the game controls remain active.

7. Save the presentation to preserve the arena. Mac and iPad show the authored
   wave sequence in the camera preview and movie export. Hand poses and the
   round's hits, blocks and energy stay with the live session.

[Open the editable Techno Droid Arena project]({{< asset-url "downloads/musimotion/visionos/MusimotionVR-Techno-Droid-Arena.musimotion.zip" >}}).
Unzip it and use **Open** in an updated Musimotion editor. Its score spans
all three waves. On Vision Pro, use **Full Immersion** to play.

[Watch the full 42-second camera preview with music]({{< asset-url "downloads/musimotion/visionos/Techno-Droid-Arena.mp4" >}}).
The preview shows the authored droid formations and incoming pulses. The
[native sample manifest]({{< asset-url "downloads/musimotion/visionos/droid-beats-manifest.json" >}}) records the
project, movie and music checksums and the composer credited for each take.

## 12. Select, edit and copy objects

1. Open your presentation and pause at a time when the object is visible.
   On Mac, click a shape or visible lettering once in **2D** or **3D Volume**.
   Where an arrow and a banner overlap, clicking the
   arrow selects it. Clicking exposed lettering selects the banner. A 3D
   ink stroke is selectable along the part drawn by the current time.
   **Inspector** opens for the selected object. If a brush is active,
   finish painting before selecting an object on the canvas.

   To add the example arrow, open **Shapes**, enter `arrowshape.left.circle.fill`
   in **Search all SF Symbols**, and select **Use exact symbol** or press Return.
   Close **Shapes** to work on the canvas again.

   {{< musimotion-capture "editor-mac-arrow-search.webp" "Mac Shapes palette showing arrowshape.left.circle.fill in the search field and the matching Use exact symbol action" >}}

   *Mac, synthetic presentation. The exact name brings up the mint action and the matching arrow in the results below.*

   {{< musimotion-capture "editor-mac-welcome-arrow.webp" "The selected WELCOME lettering near the left of the 3D box and a separate teal circular arrow near its center" >}}

   *Mac. The outline is on the welcome lettering. Click the small teal arrow near the center of the box to switch objects.*

2. To reach an object behind another object, a hidden object or a silent
   audio layer, choose **Objects** above the canvas. Select the scene, then
   the object's row. You can also select paint buffers, ink and particle
   strokes, emitters and the scene's celebration, rhythm or droid settings.
   Choosing an object from this list works even when its layer is outside
   the current playhead time.

3. In **Inspector**, change **Name**, then use the controls for that object.
   For a shape, change its color, scale or rotation. **Edit XYZ** sets a
   precise position at a chosen time in a 3D scene. Text, media, strokes
   and scene effects each expose controls for the data they contain. For a balloon drop, open **Celebration Effects…** to
   adjust balloon count, fall speed, wind and bounce. For a droid
   formation, **Droid Arena Settings…** changes its number of waves.

   {{< musimotion-capture "editor-mac-selected-arrow.webp" "Mac camera with the arrow outlined beside the Inspector showing arrowshape.left.circle.fill, Color, Opacity, Scale and Rotation" >}}

   *Mac. After one click, the outline moves to the arrow. Its SF Symbol name and appearance controls appear in Inspector.*

4. If an object from an older presentation has the same **Enters** and
   **Exits** times at the very end of its scene, it has no time to appear during
   playback. Select it in **Objects**. At the top of **Inspector**, choose
   **Use Final Second**. In an eight-second scene, an 8.00–8.00
   second layer then spans 7.00–8.00. The playhead moves to 7.00 so
   the object is visible immediately. For a different interval, edit
   **Enters** or **Exits** in the inspector’s **Timeline** section.

   {{< musimotion-capture "editor-mac-recover-arrow.webp" "Mac Inspector showing This object starts at the end of the scene above Use Final Second for Left Arrow" >}}

   *Mac, synthetic legacy project. Left Arrow is selected even though the camera has no arrow to draw at the current time.*

   {{< musimotion-capture "editor-mac-recovered-arrow.webp" "Mac Objects list with Left Arrow selected, visible arrow in front of the welcome lettering, and transport showing seven of eight seconds" >}}

   *Mac. Use Final Second moved the playhead to 00:07. The camera shows the arrow and the welcome text together. The original eight-second duration is preserved.*

5. Choose **Edit Object → Copy**, select a destination scene, then choose
   **Paste**. Select the pasted copy and edit its name or color. The
   source keeps its own settings. On Mac, use **⌘C**, **⌘X** and **⌘V**
   for the selected object. Inside a text field, these shortcuts edit
   the selected text. Use **Duplicate** for another copy in the same
   scene, or **Cut** to move it. For a scene effect, **Duplicate
   in New Scene** creates a separate scene with an editable effect. A
   copied rhythm chart brings its song and custom panorama with it.

   {{< musimotion-capture "editor-mac-pasted-arrow.webp" "Mac Objects list showing Welcome Banner, arrowshape.left.circle.fill and a checked arrowshape.left.circle.fill Copy" >}}

   *Mac. The checkmark identifies the pasted arrow. Both the original arrow and the Welcome Banner remain in the scene.*

6. Select the small split-rectangle icon at the far right of the transport row to show or hide the layer tracks. Its accessibility label switches between **Show Timeline** and **Hide Timeline**. Drag the scrubber on the separate row underneath to find a frame.

   {{< musimotion-capture "editor-controls/timeline-toggle.webp" "Timeline toggle to the right of Record Keyframe, on the row above the scrubber" >}}

   *The [editor controls walkthrough]({{< relref "musimotion-editor-controls.md" >}}) shows both timeline states.*

7. To start from existing artwork, choose **Templates**. Select **Welcome
   Banner**, **Birthday Surprise**, **Rhythm Stage** or **Droid Arena**.
   **Import into Presentation** adds a scene to the project you are editing.
   Undo removes that import. **Open as New Presentation** saves your
   current work in the library and opens a separate editable project.
   If saving fails, the browser displays the error and keeps your
   current presentation open. On Vision Pro, **Project → Templates**
   opens the same browser from the spatial workspace.

   {{< musimotion-capture "editor-vision-templates.webp" "Vision Pro simulator Templates browser with four scene choices and buttons to open or import the selected Droid Arena" >}}

   *Vision Pro simulator. Droid Arena is selected. Choose Open as New Presentation or Import into Presentation at the bottom of the sheet.*

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
