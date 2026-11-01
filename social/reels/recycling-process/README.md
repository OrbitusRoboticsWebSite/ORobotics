# ROB workshop notes: the process

Published website previews: <https://www.orbitusrobotics.com/recycling/#process>.
Facebook copy and publication status: `social/drafts/recycling-process-2026-10-31.md`.

Two 1080×1920, 30 fps SDR reels expand the first highlights:

- **Grip + lift:** about 27 seconds. An open gripper reaches toward the table,
  then a close-up shows the fingers closing around a can. A later excerpt
  holds through the lift until the can is clear of the table.
- **Turn + release:** about 18 seconds. The full torso rotation plays as an
  unbroken 10.3-second excerpt with the tracked base visible. A close-up of a
  can release follows.

All motion remains at normal speed. Cuts omit pauses and setup. Excerpts from
different tests are disclosed; the edits are not a reliability demonstration
or a claim of uninterrupted autonomy. The reach comes from another take;
grasp, lift and torso turn are excerpts of IMG_9433. Private source originals,
review contact sheets and audio-review files remain outside Git.

Ten additional workshop recordings were reviewed. Large motion scores caused
by camera movement were rejected. IMG_9428 includes a reverse approach and is
not used as evidence of torso rotation. The chosen torso excerpt visibly
rotates the upper body relative to the tracked base.

Titles occupy dedicated space outside the full camera frame. The original
audio is retained, with the existing low-rumble filter, peak limiter, and
short fades at cuts. A final two-pass loudness adjustment targets -18 LUFS
and -1.5 dBTP so quiet motors and voices remain audible beside the can impact.
The video stream is copied unchanged in that final audio pass.
No music or fabricated effects were added. The robot
voice in the lift is partly indistinct; its movement plan is described in
caption brackets instead of inventing an exact quotation. Human reactions and
the can clatter are captioned. English VTT and Facebook SRT files are included.

## Rebuild and verification

Export the manifest's private source excerpts to a working folder using
`scripts/export-recycling-sdr.swift`, as documented in the original
`social/reels/recycling/README.md`. Export at 1080 resolution.

```sh
python3 scripts/build-recycling-reels.py --edit social/reels/recycling-process/edit.json --shots SHOTS --work WORK --output OUTPUT --format pickup
python3 scripts/build-recycling-reels.py --edit social/reels/recycling-process/edit.json --shots SHOTS --work WORK --output OUTPUT --format torso
```

The shared renderer defaults to the original manifest, preserving its existing
commands. Validate full video/audio decoding, codecs, dimensions, duration,
SDR color, fast-start metadata, caption times, and metadata removal. Inspect
each action and cut, then verify both players on desktop and mobile. Artifact
hashes are recorded in `release.json`.

The total static-site budget is 375 MiB, increased from 350 MiB to accommodate
these two additional compressed reels. All four recycling players use
`preload="none"`; visiting the page does not download the videos automatically.
