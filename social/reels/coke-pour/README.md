# ROB's actual Coke pour

Watch: <https://www.orbitusrobotics.com/coke-pour/>.
Download: <https://www.orbitusrobotics.com/videos/workshop/rob-coke-pour-reel.mp4>.
Exact Facebook draft: `social/drafts/coke-pour-2026-11-01.md`.

The approximately 31-second vertical reel uses the newly synced IMG_9522
recording. Thirteen new robot videos, IMG_9514 through IMG_9526, were downloaded
and visually surveyed. The selected take shows the actual stream of Coke,
human assistance moving the glass, a spill, and the can returning upright.
This is a supervised prototype test, not evidence of autonomous pouring or a
reliability demonstration. The previous setup teaser remains a separate reel.

## Edit

| Reel time | Source time | What remains visible |
| --- | --- | --- |
| 0–17.5 s | IMG_9522, 23–40.5 s | Can tipping, visible stream, glass filling, human assistance and spill |
| 17.5–28.5 s | IMG_9522, 49–60 s | Wrist returns the can upright |
| 28.5–30.5 s | End card | Pour. Learn. Repeat. |

The two excerpts play at normal speed. The intervening hold and the long waits
outside the excerpts are omitted. The normalized crop retains the entire can,
stream, glass and assisting hand throughout the chosen action. Source originals,
camera stills, contact sheets and local transcription logs remain outside Git.
Only the finished promotional video and its designed poster are published.

The soundtrack is the selected original recording, with high-pass filtering,
short fades, peak limiting and two-pass loudness adjustment. No music or
simulated pouring sounds are added. Local transcription was used to locate
speech and avoid starting in the middle of a phrase; indistinct background
voices are labeled rather than assigned invented dialogue.

## Rebuild

Use `scripts/export-recycling-sdr.swift` to export each source range in
`edit.json` at 1080 resolution. Name the private SDR H.264 exports `pour.mp4`
and `recover.mp4`. Apple's native exporter handles the camera's HDR conversion.

```sh
python3 scripts/build-recycling-reels.py --edit social/reels/coke-pour/edit.json --shots SHOTS --work WORK --output OUTPUT --format reel
```

Review the complete edit and both sides of every cut. Validate full decoding,
1080×1920 H.264 at 30 fps, SDR BT.709, AAC audio, fast-start layout, title bounds,
removed camera metadata and loudness. Build and validate the website before
publishing. Exact artifact hashes and release observations are in `release.json`.

## Visual description

ROB tilts a red Coca-Cola can held in its gripper. A visible stream enters a
clear glass while a person catches and repositions it. The glass fills partway;
liquid is visible on the table. After a cut, the robot's wrist brings the can
upright. Titles identify the actual Coke pour and return upright, with the
persistent footer “Assisted prototype test · Normal speed.” The ending reads
“Pour. Learn. Repeat.” and links to Orbitus Robotics.
