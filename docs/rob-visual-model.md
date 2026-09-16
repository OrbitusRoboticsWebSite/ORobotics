# ROB captured models

The homepage and `/rob-model/` use six detailed reconstructions extracted from
the new Gaussian-splat PLY captures. Each display GLB contains about 240,000
triangles and loads only when selected. `static/models/rob/scan-provenance.json`
records source and reconstructed-mesh hashes, display transforms, triangle
counts and output hashes. Original PLYs, visual splats and editable masters
remain in `ROB Scans/Extracted`; the website does not modify those files.

The browser game, interactive showcase, RealityKit game and Cerebro SceneKit
preview share a lighter upright capture: 113,900 triangles in nine surface
pieces. The captured chassis, treads, torso, arms, neck and head are attached to
the existing animation hierarchy. Procedural perforated flippers, end rollers
and face LEDs remain, retaining the flipper and face controls. The
captured speakers and tread surfaces retain their photographed reference pose;
their individual cone/road-wheel surfaces are not separately rigged.

The runtime bundle is three files, copied unchanged into both Apple projects:

- `rob-visual.json`: hierarchy, scaffold meshes, materials and capture provenance.
- `rob-captured.bin`: little-endian interleaved float32 position XYZ, normal XYZ
  and UV (32 bytes per vertex). Each buffer range is an unindexed triangle list.
- `rob-captured-colors.png`: captured-color triangle atlas.

`assets/js/rob-captured-model.mjs` attaches those surfaces asynchronously, keeping
the procedural model usable while loading and if a request fails. Graphite
preserves the capture colors; other finishes tint them. Apple adapters cache
decoded geometry and textures. RealityKit keeps the game's simple chassis
collision box rather than generating convex hulls from the detailed scan.

Regenerate from the reviewed reconstructions using the sibling ROBGeometryLab
extraction environment (Open3D, numpy, Pillow) and its extraction helper:

```sh
npm ci
../ROBGeometryLab/build/splat-venv/bin/python scripts/prepare-captured-rob.py '../ROB Scans/Extracted' static/models/rob
```

Use `--runtime-only` to rebuild only the shared runtime bundle. The preparation
script invokes `export-rob-visual.mjs` with a temporary destination to obtain the
procedural scaffold; do not use that scaffold as the published captured model.
Copy all three runtime files to `ROBTrainingGames/Shared/Resources/` and
`Cerebro/Cerebro/`. Keep the two `ROBScanVisualModel.swift` adapters identical;
run XcodeGen in ROBTrainingGames when adding resources.

Presentation coordinates are Y-up, forward -Z, with 1.35× RealityKit, 1.2×
SceneKit and 2.15× browser-game scaling. Surface partitions and pivots are
illustrative. The flipper scaffold uses the earlier 13.25-inch length; a
13.5-inch scan reading still has unresolved endpoints. These assets do not
replace calibrated URDFs, geometry profiles, encoder references or joint limits.
Cerebro leaves flippers at their reference pose without measured angle feedback.

`npm test` checks capture loading/fallback, geometry ranges, independent head
motion, flipper clearance, GLB structure, gameplay, Hugo and subpath URLs.
Native validation uses iOS tests, a visionOS build, Cerebro's standalone
`Scripts/test-rob-visual.sh` render fixture and the full macOS application build.
For a side-by-side contact review, serve this repository with a local HTTP
server and open `tests/rob-climb-preview.html` after installing npm dependencies.

The captured base is aligned with the flipper rig. The virtual training laser
uses the captured shoulder housing and a named muzzle attachment, with no
additional housing. These attachment points are visual game effects only.

The training games use front-lift, rear-support and level travel stages. The rear
contact stays grounded during deployment; after front engagement, forward drive
reverses the flippers automatically and raises the rear while the front stays on
the step. This is a geometric contact approximation, not a full rigid-body solver.
The browser bubble shield is button/E/gamepad activated for 2.5 seconds, matching
the native rules. Only an active bubble absorbs damage; repeated taps do not extend it.
