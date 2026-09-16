# ROB scan showcase and articulated visual model

The homepage and `/rob-model/` show the six original September 15, 2026
photogrammetry poses. `static/models/rob/scan-provenance.json` records original
and exported SHA-256 hashes, crop bounds, triangle counts and texture sizes.
Each GLB loads only when selected. Original USDZs are not modified or committed.

Regenerate the display scans on macOS with numpy and Pillow installed:

```sh
python3 scripts/convert-rob-scans.py '../ROB Scans' static/models/rob
```

The converter accepts the supplied single, untransformed, Y-up triangle meshes
with per-vertex UVs. It crops distant surroundings and downsizes the photographic
texture to 2048 pixels. This is a display crop: some grass, supports and scan
holes remain. It does not invent missing scan surfaces or derive joint angles.

`assets/js/rob-visual-model.mjs` is the source for the movable model. Its faceted
camera head, paired optics, open neck/waist, twin chest speakers, seven-joint arms,
asymmetric triangular belts and perforated flipper plates follow the scans.
Both flipper plates share the rear wheel axle, sit outside the tracks, and have
separate end rollers. There is no spanning blade or front crossbar.

The visual uses Y-up meters, forward -Z, with 1.35× native-game and 2.15× browser
presentation scaling. Export its engine-neutral meshes and hierarchy with:

```sh
node scripts/export-rob-visual.mjs
```

Copy `static/models/rob/rob-visual.json` unchanged to
`ROBTrainingGames/Shared/Resources/rob-visual.json` and
`Cerebro/Cerebro/rob-visual.json`. Both Apple products use identical
`ROBScanVisualModel.swift` adapters for RealityKit/SceneKit. Keep exported files
and source adapters identical across repositories when revising this model.

Wheel spacing uses the operator's 16.75-inch scan reading; flipper length uses
13.25 inches (336.55 mm). A later scan ruler reads 13.5 inches (342.9 mm): that
6.35 mm difference and the precise endpoints remain unresolved. All remaining
visual dimensions and pivots are estimates. This asset must not replace the
robot's calibration profile, URDF, encoder references or physical joint limits.
Cerebro leaves the flippers at their reference pose because controller demands
do not provide measured flipper angle feedback.

The browser now matches the native game's full 360-degree flipper cycle. A
display-only support offset keeps the end rollers above the floor throughout
the animation; this is not a physics model or an actuator command.

Validation: `npm test` covers model pivots, through holes, roller clearance,
GLB structure, gameplay, the production Hugo build and subpath-safe URLs.
Native validation uses ROB Training's iOS tests/visionOS build and Cerebro's
`Scripts/test-rob-visual.sh` plus the full application build. The latter script
accepts an optional PNG output path for a standalone SceneKit render.
