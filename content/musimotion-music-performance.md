---
title: "Hear and replace a Musimotion score"
description: "Compare two shamisen performances and two techno arrangements, then audition a new take under an existing opening."
url: "/products/musimotion/music-performance/"
draft: false
---

[Musimotion]({{< relref "musimotion.md" >}}) · [Generate a soundtrack]({{< relref "musimotion-vision-guide.md" >}}#10-generate-a-soundtrack)

November 20, 2026 · Development preview for Mac, iPad and Vision Pro

Listen to the same musical brief played by two versions of Musimotion. Each pair uses the same prompt, local composer, seed, tempo and number of bars. Playback levels are matched. All four examples are synthesized instrumental performances.

## Shamisen at 64 BPM

**The Ink Gate** opens with four bars of shamisen. Listen to the attack on a low note and the space it leaves for the answering phrase. In the revised take, a stronger downward pick can strike the instrument’s skin, a return stroke sounds lighter, and a left-hand pluck releases the string. In the second bar, listen for a sliding downstroke followed by a lower, softer pluck. The final note settles on the open low D. All four bars follow a different sequence of pitches in the revised example. On the acoustic instrument, the plectrum is called a *bachi*. Players can also pluck with the left hand (*hajiki*) or slide a finger along a ringing string (*suri*). [Japan Arts Council guide to the shamisen](https://www2.ntj.jac.go.jp/unesco/bunraku/en/performer/performer2.html) · [Pro Musica Nipponia’s playing techniques](https://www.promusica.or.jp/english/shamisen.html)

<p><strong>Earlier shamisen</strong> · 15 seconds</p>
<audio controls preload="none" style="display:block;width:100%;max-width:32rem" aria-label="Earlier shamisen, 15 seconds"><source src="https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/shamisen-before.m4a" type="audio/mp4"></audio>

[Download Earlier shamisen (AAC)](https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/shamisen-before.m4a)

<p><strong>Revised shamisen</strong> · 15 seconds</p>
<audio controls preload="none" style="display:block;width:100%;max-width:32rem" aria-label="Revised shamisen, 15 seconds"><source src="https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/shamisen-after.m4a" type="audio/mp4"></audio>

[Download Revised shamisen (AAC)](https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/shamisen-after.m4a)

## Techno at 128 BPM

Both takes use the **Electronic** ensemble and run for eight bars. Follow the bass between the kicks, then listen for the lead’s answer in the second four bars. The revised performance gives the bass its own low register and leaves space ahead of each kick. The earlier example has five distinct bass pitch sequences across eight bars. In the revised example each bar has its own bass sequence.

<p><strong>Earlier techno</strong> · 15 seconds</p>
<audio controls preload="none" style="display:block;width:100%;max-width:32rem" aria-label="Earlier techno, 15 seconds"><source src="https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/techno-before.m4a" type="audio/mp4"></audio>

[Download Earlier techno (AAC)](https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/techno-before.m4a)

<p><strong>Revised techno</strong> · 15 seconds</p>
<audio controls preload="none" style="display:block;width:100%;max-width:32rem" aria-label="Revised techno, 15 seconds"><source src="https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/techno-after.m4a" type="audio/mp4"></audio>

[Download Revised techno (AAC)](https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/techno-after.m4a)

## Audition a new opening

A saved presentation carries its own recording. Opening it plays the score you saved. New **Shamisen** and **Techno** takes use the revised performances automatically, including shamisen scores in newly created black dragon templates. You can listen to a new take before changing the recording in a saved project.

1. Open a scored presentation such as **The Ink Gate**. Choose **Objects**, select **The Ink Gate · Shamisen**, then open **Music Studio**. In the Vision Pro spatial workspace, open **Add Media → Music Studio**. Check the track name beside **Replace Track**. With a single generated soundtrack in the scene, Music Studio finds it automatically. For an existing generated score, the style, tempo and bar count come from its saved credits.

{{< musimotion-capture "music-performance/replace-start.webp" "Music Studio showing The Ink Gate · Shamisen, 64 BPM and four bars before generating a take" >}}

*The iPad simulator shows the existing track name below Generate Music. Shamisen, 64 BPM and 4 bars came from the saved score.*

2. Choose **Generate Music**, then **Preview** to hear the new take. Choose **New Variation** to try another. You can leave Music Studio without applying a take and keep the original opening.

{{< musimotion-capture "music-performance/replace-preview.webp" "Signal Pulse playing in Music Studio, with Stop Preview and Replace Track beside the named shamisen target" >}}

*Signal Pulse is playing in this iPad simulator capture. Stop Preview ends the audition. Replace Track applies it to The Ink Gate · Shamisen.*

3. To keep the take, choose **Replace Track**. Play the opening with its animation. Save the project to keep this performance.

{{< musimotion-capture "music-performance/replace-applied.webp" "The Objects list shows the replacement Signal Pulse selected below the dedication" >}}

*The selected audio row now reads Signal Pulse. Return to the start to hear the replacement in time with the opening.*

4. To restore the saved performance immediately after replacing it, choose **Undo**. Look for **The Ink Gate · Shamisen** again in the Objects list.

{{< musimotion-capture "music-performance/replace-undone.webp" "The Objects list shows The Ink Gate · Shamisen again after Undo" >}}

*Undo restores the original recording on the same layer.*

If **Replace Track** is dimmed, finish **Generate Music** first. If the target row is missing or names a different clip, choose **Done**, select the audio layer under **Objects** and reopen **Music Studio**. For an imported track with a late trim start, the new take needs to run beyond that point. If the editor asks for a longer take, choose more bars or move the trim start earlier. **Add to Scene** creates another audio layer at the playhead.

To carry the selected music beyond its first pass, turn on **Continue soundtrack** in **Scene Timing…**. [Extend the opening and continue its music]({{< relref "musimotion-video-templates.md" >}}#extend-a-scene-and-its-soundtrack).

## Bring in a track from Gemini

Music Studio renders music on your device. To bring in a track you created separately in Gemini, choose **Download** on the Gemini track and select the audio-only **MP3**. In Musimotion’s artwork editor choose **Add Media**, select the folder-plus button labeled **Import a photo, movie, or audio file**, and choose the MP3. [Google’s music download instructions](https://support.google.com/gemini/answer/16901237?co=GENIE.Platform%3DDesktop&hl=en).

[Recording settings, loudness and checksums](https://github.com/OrbitusRoboticsWebSite/ORobotics/releases/download/musimotion-performance-2026-11-20/listening-notes.json) · [Development notes]({{< asset-url "downloads/musimotion/music-performance/development-notes.json" >}}) · [Screenshot details]({{< asset-url "images/musimotion/visionos/music-performance/provenance.json" >}})
