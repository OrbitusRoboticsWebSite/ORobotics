---
title: "Musimotion headset acceptance checklist"
url: "/products/musimotion/headset-testing/"
draft: false
description: "Internal acceptance checks for Musimotion volumetric input, readable controls, immersion, media and comfort on physical Vision Pro hardware."
---

[Return to the illustrated guide]({{< asset-url "products/musimotion/vision-guide/" >}})

November 19, 2026 · Device testing required · Status: not run

Use an updated development build and a private copy of
[the banner exercise]({{< asset-url "downloads/musimotion/visionos/MusimotionVR-Banner-Exercise.musimotion.zip" >}}).
Record the build, source commit, headset/OS, input method, posture and results in
[the results template](https://github.com/RudyAramayo/Musimotion/blob/main/docs/visionos-headset-results-template.json). Unexecuted checks
must stay `not_run`. Only internal testing is assumed.

1. **Read 2D first.** Open a legacy package, stay in 2D, play, scrub, pause, save
   and reopen. Compare text, images and four Sumi presets with Mac/iPad.
2. **Inspect actual depth.** Open Volume and pause at scene times 0, 2 and 6.
   Move your viewpoint slowly to the side. Confirm the banner has thickness,
   starts behind Z=0 and ends in front. Check the entire path for clipping.
3. **Target and drag.** Try 20 selections of differently sized, overlapping and
   rotated objects. Grab away from the centre, drag XYZ, release and re-grab.
   Confirm no initial snap and that moving an animated object records the pose
   at the intended time. Reopen to check persistence. Record misses separately
   from wrong targets. The automated direct-gesture test requires hardware:
   visionOS 26.5 Simulator supplies nil entity activation transforms.
4. **Controls.** Read and activate every original timeline button. Try the
   smallest volume size and larger text. Open/close the radial menu. Moving or
   shrinking the art must not make controls too small or place them behind it.
5. **Depth ink.** Use Paint 3D Ink. Set Z to −0.5 and draw, then +0.5 and draw
   over it from the front. Inspect the separation from the side. Erase the near
   stroke and confirm the far one remains; undo. Record live ink, rewind and
   replay. Interrupt by releasing/losing tracking and switching scenes.
6. **Full immersion and escape.** Enter from paused playback, inspect the
   surrounding scene background and floating transport, play, pause and choose
   Exit 3D. Verify exactly one editor returns. Repeat three times. Also leave
   with the Digital Crown and relaunch from Home. Check silence after exit.
7. **Comfort and accessibility.** Test seated/standing stage heights, system
   recentering, Reduce Motion, larger text, VoiceOver and alternate input. Start
   with a stationary view and slow content. Stop on discomfort and record the
   trigger and elapsed time. No automatic camera movement is expected.
8. **Media and effects.** Compare delayed/trimmed/muted audio and video,
   background video, scene crossfades, masks/blur, still paper and live ink.
   Use a reference pulse to measure audiovisual offset on speakers/headphones.
   Record unsupported physics or effect behavior explicitly; do not infer parity.
9. **Sustained use.** Only while comfortable, run representative content for up
   to 20 minutes. Use Instruments to record frame pacing, memory, thermals and
   input latency at start, 5, 10 and 20 minutes. A simulator build is not a frame
   rate or comfort measurement.
10. **Round trip.** Save a mixed-media 3D package, open on updated Mac and iPad,
    choose Front/Right side, inspect depth ink and keyframes, export a movie,
    then reopen the package on Vision Pro. Check that all source data survives.

11. **Surrounding birthday scene.** In the artwork editor choose **Celebration →
    Add Birthday Surprise**. With the playhead at the start, enter Full Immersion
    and press Play. From a comfortable seated position, check the countdown,
    greeting, overhead drop, surrounding balloons and localized fireworks. Pause
    and resume. Record whether the transport stayed reachable and the scene
    remained stationary as you turned your head.
12. **Viewer contact and tracking recovery.** Record whether **Viewer contact
    active** appears. Observe an overhead balloon and its deflection without
    moving toward it. Try an ordinary lean, then recenter and observe recovery.
    Record any clipping, sudden arena movement, or missing tracking status.
    Compare with the fixed reference view on Mac/iPad. On the headset, repeat
    with **Reduce motion** and verify stationary balloons, visible greeting,
    hidden confetti/fireworks and a usable **Exit 3D**.

The collision check uses the current device position supplied inside an immersive
space. A sphere around that point approximates the viewer for balloon contact.
The app keeps a separate origin for the arena. When evaluating tracking, record
what the display reports and how the balloons behave as you move.
[Apple’s device-transform sample](https://developer.apple.com/documentation/visionos/placing-entities-using-head-and-device-transform)
describes the underlying tracking API.

Release acceptance requires completed device results and no blocking defects.
The current implementation and simulator results alone do not satisfy this gate.
