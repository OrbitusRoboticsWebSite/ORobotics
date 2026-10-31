# ROB can-handling highlights

Published page: <https://www.orbitusrobotics.com/recycling/>

The landscape demo is about 33 seconds (1920×1080); the vertical reel is about
22 seconds (1080×1920). Both contain real camera footage and its original audio.
They use hard cuts between separate supervised tests, all at normal speed.
Long pauses, camera pans to computer screens, and unclear speech were omitted.
The footage shows a can lifted from a table, arm and wrist motion, and releases
into an orange bucket. It is not a continuous run or a reliability measurement.

The chosen frames show the robot and workshop, without identifiable bystanders.
Camera originals, local review contact sheets and transcription scratch files
are kept outside Git. The published MP4s contain only H.264 video and AAC audio;
GPS, camera dates, device metadata and auxiliary data tracks are excluded.

## Rebuild

`edit.json` records the private source filename, in-point and exact duration of
each chosen shot. A Mac with Swift/AVFoundation, FFmpeg and Python with Pillow
is required. The H.264 AVFoundation export applies Apple's HDR-to-SDR conversion
to the iPhone HLG originals. Export each shot to a private working directory:

```sh
swiftc -parse-as-library scripts/export-recycling-sdr.swift -o /tmp/export-recycling-sdr
/tmp/export-recycling-sdr SOURCE.MOV SHOTS/SHOT-ID.mp4 START DURATION 1080
```

Then render each format, using absolute paths for the private working folders:

```sh
python3 scripts/build-recycling-reels.py --shots SHOTS --work WORK --output OUTPUT --format demo
python3 scripts/build-recycling-reels.py --shots SHOTS --work WORK --output OUTPUT --format reel
```

The script retains original timing and audio, filters low rumble, limits peaks,
and adds short audio fades at cuts. It adds no music or fabricated sound effects.
The landscape version uses a darkened blurred background around portrait shots;
the foreground retains the original full frame. Titles stay clear of the can's
trajectory. Final files belong in `static/videos/recycling/`.

Verify each export with ffprobe, decode it fully with FFmpeg, inspect frames
around every edit and both releases, and check the poster, captions and page in
a browser. Hashes are recorded in `release.json`. Facebook copy is in
`social/drafts/recycling-highlights-2026-10-31.md`; publication status must reflect
the actual Facebook response.
