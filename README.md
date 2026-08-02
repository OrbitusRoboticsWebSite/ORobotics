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

Browser-ready derivatives are committed under `static/images/galleries/<album>/`:

- 320 px and 640 px cropped WebP thumbnails for the gallery grid
- WebP display images capped at 1440 px for the lightbox
- H.264/AAC MP4 video plus WebP posters for MOV sources

The conversion applies image orientation before stripping metadata. Videos are remuxed from HEVC MOV to broadly supported H.264 MP4 and are not requested until a visitor opens one.

After adding or changing local originals, install Node.js 20, ImageMagick 7, and FFmpeg, then run:

```sh
scripts/build_gallery_media.sh
npm test
```

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
