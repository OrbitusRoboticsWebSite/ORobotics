# ROB captured models

The homepage and `/rob-model/` use eight detailed reconstructions extracted from
the new Gaussian-splat PLY captures. Each display GLB contains up to about 240,000
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

Use `--display-only --stems rob-lean-back rob-lean-forward` to rebuild just the
clean lean display meshes. `--catalog` selects an explicit extraction catalog;
the default is the September 17 eight-pose catalog. Use `--runtime-only` to
rebuild only the shared runtime bundle. The preparation
script invokes `export-rob-visual.mjs` with a temporary destination to obtain the
procedural scaffold; do not use that scaffold as the published captured model.
Copy all three runtime files to `ROBTrainingGames/Shared/Resources/` and
`Cerebro/Cerebro/`. Keep the two `ROBScanVisualModel.swift` adapters identical;
run XcodeGen in ROBTrainingGames when adding resources.

Presentation coordinates are Y-up, forward -Z, with 1.35× RealityKit, 1.2×
SceneKit and 2.15× browser-game scaling. Surface partitions and pivots are
illustrative. The flipper scaffold uses the earlier 13.25-inch length; the current operator
selection is 350 mm center-to-center, pending a physical check. These assets do not
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
Once both tread ends reach the platform, the climb latch releases and Down/Up
can run again against that floor. A single tread end overhanging does not remove
the upper-floor support while the center remains on the deck. At an edge the
base tips about the supported tread end, falls under gravity after losing support, and settles on the lower
floor. A departed platform cannot retain a flipper lift or climb latch.

`rob-support-motion.mjs` and native `ROBSupportMotion.swift` match those rules.
The entire upper body swings about the hinge above the upper (third) tread wheel
at Y 0.375 m, Z 0.065 m in the model frame. Its estimated mass center at Y 0.78 m,
Z 0.012 m must project inside the tread support span; when the base pitches up,
this requires leaning forward beyond vertical. Actuator animation keeps pace
with the flippers. Mass, travel bounds, and speed are game presentation values.
The illustrative LACT pins follow the model's actuator location and have a 0.20955 m (8¼ inch) reference separation, using the labeled
photo in ROBGeometryLab's September 15 dataset. This is a pose length, not a
stroke or a measured hinge calibration. Pin separation is recomputed after
torso lean; the body leans forward during front lift and backward during a
forward descent. The visual fixture draws the linkage in orange, hinge in cyan,
and estimated body mass center in amber.

The browser bubble shield is button/E/gamepad activated for 2.5 seconds, matching
the native rules. Only an active bubble absorbs damage; repeated taps do not extend it.

## Lean captures and pickup missions

`rob-lean-forward.glb` is the operator-confirmed 302 mm fully extended LACT
pose; `rob-lean-back.glb` is the 200 mm fully retracted pose. Their source
reconstructions use the `-clean-floor` extraction revisions. Near-floor masks
remove the yellow workshop floor patch while preserving the yellow grippers.
They remain independently unregistered; the display yaw is presentation only.

The game keeps the existing articulated upright capture. Each of its 24 missions
now adds a supply crate, battery module or chess pawn and a matching delivery
pad/square. C toggles the pickup lean; G grasps/places. Browser gamepad B/X and
on-screen Lean/Grab buttons expose the same actions. Drive slowly to align the
right hand, release both treads, grasp, carry, lean and place on the destination.
Dropping elsewhere leaves the object available for another attempt. Delivery
adds 350 arcade points once and is required before finishing the level.

`rob-pickup.mjs` and native `ROBPickup.swift` share the interaction guards, reward,
lean rate, carry states and drive scaling. `rob-pickup-visual.mjs` keeps the arms
hanging as the torso leans; the right hand carries the object during travel.
The -0.85 rad game lean and 0.22 × presentation-scale grasp tolerance are
illustrative, not an actuator calibration or solved physical arm trajectory.
The current rule version is `2026.09.17.2`.
