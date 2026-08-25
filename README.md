# OrbitusRobotics.com

Static Hugo site for Orbitus Robotics, deployed to GitHub Pages.

## Local development

Requirements:

- Hugo Extended 0.164.0
- Node.js 20 or newer
- npm

```sh
npm ci
npm start
```

Create a production build and run the gallery checks:

```sh
npm test
```

## Gallery media

Camera originals live locally under the Git-ignored `media/gallery-originals/<album>/` directory. They are deliberately excluded from version control and Hugo's `static` directory because camera files can contain precise GPS, timestamps, and device metadata. Back them up in private storage; the website build does not require them.

The committed `data/galleries.json` manifest is the sanitized inventory Hugo uses at build time. It contains only album names, filenames, and media kinds—never EXIF metadata. The media script refreshes it whenever originals are converted and prunes orphaned derivatives from each processed album.

Human-authored accessibility content lives separately in `data/gallery_metadata.json`, keyed by the stable `album/filename` identity from the manifest. Every media item has concise, visually grounded alt text. Optional editorial captions can override the lightbox copy, while videos can also reference an English WebVTT file and include the matching plain-text transcript. Keeping this content separate ensures that rebuilding generated media never overwrites the descriptions.

Browser-ready derivatives are committed under `static/images/galleries/<album>/`:

- 320 px and 640 px cropped WebP thumbnails for the gallery grid
- WebP display images capped at 1440 px for the lightbox
- H.264/AAC MP4 video plus WebP posters for MOV sources
- WebVTT captions under `static/captions/galleries/<album>/` when a video contains meaningful audio

The conversion applies image orientation before stripping metadata. Videos are remuxed from HEVC MOV to broadly supported H.264 MP4 and are not requested until a visitor opens one.

After adding or changing local originals, install Node.js 20, ImageMagick 7, and FFmpeg, then run:

```sh
scripts/build_gallery_media.sh
npm test
```

After adding media, add the matching `album/filename` entry to `data/gallery_metadata.json`. Describe the visible subject or action rather than the filename or a generic phrase such as "Photo 1." For a video with speech or meaningful sound, add both fields below and keep their wording synchronized:

```json
{
  "captions": "captions/galleries/2019/example.vtt",
  "transcript": "Complete plain-text transcript for visitors who prefer to read it."
}
```

If verified transcription is not yet available, the video entry must carry `"captionStatus": "pending-transcription"`. This is an explicit temporary exception: remove it as soon as the synchronized `captions` and `transcript` fields are added. Gallery WebVTT files intentionally support a `WEBVTT` header followed by ordered timed cues; `STYLE` and `REGION` blocks are rejected so the published caption contract stays simple and consistently testable.

The lightbox enables the WebVTT track by default and reveals the transcript in a reader-controlled disclosure. Each gallery with captioned video also publishes an always-available transcript archive for visitors without JavaScript or dialog support. Gallery validation rejects missing metadata, generic or duplicate alt text, unmatched caption/transcript fields, reused or orphaned caption files, out-of-sync transcript text, unsafe caption paths, and malformed WebVTT cues.

Pass one or more album folder names to rebuild only those albums:

```sh
scripts/build_gallery_media.sh 2025
```

Use `--force` after intentionally changing encoding settings:

```sh
scripts/build_gallery_media.sh --force
```

Do not move gallery originals back under `static` or force-add the ignored archive. The validation step rejects legacy raw-album paths, HEIC/MOV files, malformed or metadata-bearing derivatives, missing/oversized media, and gallery markup that loses responsive lazy loading.

If originals were previously pushed to a public remote, removing them from the current tree does not erase old commits. Rewrite the remote history or rotate the repository before treating embedded location data as removed.

## Deployment

Pushing `main` runs `.github/workflows/hugo.yml`, builds the site, validates the generated gallery, and deploys the `public` artifact to GitHub Pages. The canonical site URL is `https://www.orbitusrobotics.com/`.

The Musimotion page can read creator-published records from its public CloudKit database. Follow [the Musimotion community gallery setup](docs/musimotion-cloudkit-gallery.md) to create a domain-restricted website token, add preview fields, and connect the production gallery without exposing a server private key.

The ROB Training game uses that same public CloudKit container and website token for a separate, Apple-authenticated leaderboard record type. Follow [the ROB CloudKit leaderboard setup](docs/rob-cloudkit-leaderboard.md) to add its schema, indexes, and narrowly scoped security roles before publishing scores in production.

## Robotics learning lab

`/robot-lab/` is a static four-mission learning game built from `content/robot-lab.md`, `layouts/robot-lab/single.html`, and `assets/js/robot-lab.js`. It teaches feedback systems, PWM duty cycle, differential-drive prediction, and authenticated-but-stale command rejection. The game uses no backend, accounts, analytics, robot connection, or persistent learner data and remains keyboard accessible.

`/rob-simulator/` is a locally bundled Three.js tank-driving game. Its fifteen-level campaign uses expanded arenas and models ROB with dual seven-joint AMBER-style arms, wide alternating saber swings and a third-hit torso spin, a scanning and chargeable right-shoulder gatling laser, ROBController-style dual tread joysticks on mobile, keyboard tread mixing, an oriented tread-and-chassis collision footprint, keys and locked doors, multiple attacking enemies, collectible energy cells, and a final docking objective. It supports keyboard, pointer/touch, and gamepad input and never connects to a physical robot. Completed campaigns keep a local top ten and, when CloudKit is configured and the player signs in with Apple, publish one public best score per account.

For this custom GitHub Actions deployment, the custom domain configured under
**Settings → Pages** is authoritative. `static/CNAME` mirrors that value in the
generated artifact for portability, but GitHub Pages does not use it to set the
domain for an Actions-based deployment.

In the repository's GitHub Pages settings, keep **Build and deployment →
Source** set to **GitHub Actions**. Branch-based Pages deployment invokes
Jekyll against the Hugo source tree and is not supported by this site.

The TailBliss files used by the build are maintained directly in this
repository's `assets`, `layouts`, and `static` directories. Do not add a
`themes/tailbliss` submodule: the production workflow does not use it, and
upstream example-site symlinks can create recursive paths for generic site
builders.
