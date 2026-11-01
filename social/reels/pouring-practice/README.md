# ROB pouring-practice teaser

Review video: <https://www.orbitusrobotics.com/videos/workshop/rob-pouring-practice-reel.mp4>.
Facebook draft: `social/drafts/pouring-practice-2026-11-01.md`.

This approximately 17-second vertical reel uses four excerpts from the new
Coke-can and glass session. Six recent iCloud videos were downloaded and
reviewed: IMG_9493, IMG_9494, IMG_9495, IMG_9497, IMG_9498, and IMG_9499.
The latest iCloud Recents view was refreshed and checked through its final item.
The available footage shows setup and arm positioning. It does **not** show
liquid leaving the can or a completed pour, and the reel makes no such claim.

All action is at normal speed. Cuts omit holds and camera repositioning.
Landscape shots retain the full camera frame over a softened background so
the can, glass and both arms remain visible. Portrait shots use the established
workshop layout, with titles outside the camera frame. The ending says
"One step at a time." Private originals, contact sheets, and audio-review
files remain outside Git.

The original selected audio is retained with the shared renderer's high-pass
filter, peak limiter, short cut fades and two-pass loudness adjustment.
IMG_9498 was excluded because it contains unrelated background conversation.
The IMG_9495 excerpt begins after the dialogue at the start of that take.
No dialogue is quoted, and no music or simulated pouring sounds are added.

## Rebuild

Use `scripts/export-recycling-sdr.swift` to export the manifest's private source
excerpts at 1080 resolution. Give each export its shot ID from `edit.json`.
Then run:

```sh
python3 scripts/build-recycling-reels.py --edit social/reels/pouring-practice/edit.json --shots SHOTS --work WORK --output OUTPUT --format reel
```

Review the whole reel and every cut, then validate dimensions, SDR color,
full decoding, loudness, fast-start metadata and removal of camera metadata.
Final artifact hashes and observed release status are in `release.json`.

## Visual transcript

ROB stands beside a table with a red Coca-Cola can and a clear glass.
An arm and wrist change position during separate supervised test excerpts.
A close view shows the open gripper near the can and glass. The can remains
upright; no pour occurs in these excerpts. Titles read "A can. A glass.
A challenge", "Small moves first", "Fine-tuning the setup", and "Working
toward the pour". The footer identifies setup and positioning at normal speed.
Ambient sound accompanies the footage. The end card reads "Orbitus Robotics",
"One step at a time", and "orbitusrobotics.com".
