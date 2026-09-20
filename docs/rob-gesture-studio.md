# ROB Gesture Studio

Route: /rob-gestures/. The 3D model and Training page link to the editor.
This is a browser-only authoring and rehearsal tool, with no robot transport.

The cleaned 200 mm LACT scan is partitioned into 43 rigid surfaces attached to
the approved 45-link URDF hierarchy. All 222,984 triangles remain present;
rest-pose reconstruction differs by at most 0.000017 mm from float conversion.
That number measures preservation of the scan, not physical calibration
accuracy. Automatic cuts use the nearest sampled URDF surface and need review
at overlapping housings, cables and occluded joints. Segment colors expose the
cuts. Gripper fingers are not separately articulated; LACT scan pieces are
rigid approximations rather than a telescoping mechanical simulation.
The six scan patches assigned to tread wheels also contain rubber-belt surface.
Their rest transforms are preserved on the fixed tread frames, so they no longer
orbit wheel axles. Wheel joint coordinates remain available; this scan does not
animate rubber deformation or belt circulation.

Source profile SHA-256:
ba63a659f10085da3fa7f7c5002f17b4af27596408bc447e0ac64cdb4198c2d7.
The source extraction, scan and generator hashes are in the public asset
manifest and segmentation report. Geometry Lab owns the segmentation recipe:
Scripts/build-behavior-rig.py in RudyAramayo/ROBGeometryLab.
Original scans remain unchanged.

## Author a gesture

Choose a preset or **New gesture**, move the timeline, select a joint and set
its offset, then capture a keyframe. **Validate & preview** applies the script.
Download/import JSON to keep or exchange work. There is no cloud save or
JavaScript evaluation. A failed import leaves the previously valid clip intact.

Scripts use version 1, simulationOnly true, kind "gesture", a name,
duration in seconds and joint tracks of [timeSeconds, offsetDegrees].
Offsets are from the approved hanging reference in URDF model coordinates;
they are not raw motor signs or motor-count units. ROB-left remains R-11,
ROB-right remains L-10.

Quintic interpolation gives zero velocity and acceleration at keyframes and
does not overshoot their range. Validation checks known joints, finite values,
strictly increasing time, zero-offset first/last poses, bounds, and peak
interpolated angular speed/acceleration. All fourteen B1 joints now use an
operator-requested **−120° to +120° from upright servo center**, not from the
hanging scan. Model zero extends the arm along the mounting plate's outward
normal (plate X cross plate Y), retaining each mount's 20° cant. Scripts keep
scan-relative offsets: `centeredDegrees = scanReferenceRadians * 180/pi + offset`.
The slider displays the centered angle and separately lists the scan reference
and current offset. Angles are unwrapped; a 360° request is rejected.

The left J2 scan estimate is −119.4805°, leaving only 0.5195° farther negative
and 239.4805° positive within the provisional range. Right J2 is +120.4172°,
0.4172° outside it. Preserve that observed estimate, flag the discrepancy and
block gestures that move that joint; do not shift zero, clamp the scan, or
silently widen the range. The 'Ready to help' candidate remains listed as
unavailable and is omitted from playable downloads pending this review.
Captured out-of-range reference poses may be displayed without constituting a
valid transition. Frozen URDF limits, raw motor zeros and cable limits are
unchanged and remain distinct from this simulation policy.

Flippers use a separate ±180° simulation offset window so their end wheels can
sweep from front support, over the top, to contact behind the droid. These are
preview settings, not modifications to the frozen calibration or motor limits.

Four playable starter clips are included: Curious glance, A thoughtful nod,
A small hello and Listening. Ready to help awaits the right-J2 reference review.
The GLB download includes the same 43 segments and four checked clips. Root conversion makes the portable GLB Y-up;
the browser rig and calibration stay X-forward, Y-ROB-left, Z-up.
The 34-second hello raises ROB-left/R-11 outside the shoulder, holds the hand
above the head for two side-to-side waves, then returns to the hanging reference.
The duration preserves the current slow arm speed and acceleration bounds.

## Head clearance and IK

`ArmClearancePreview` encloses every vertex of each of the sixteen moving arm
scan segments in a closed convex hull. It protects the scanned Insta360 head
and upper OAK-D camera with a provisional 25 mm gap. BVH surface-distance
queries plus containment tests reject intersections and enclosed collisions.
This is conservative relative to those captured surfaces; it does not recover
missing geometry or establish physical calibration accuracy. Torso, arm/arm,
neck, cables, payloads and environment collisions are not covered by this check.

Validation checks the whole interpolated path. Between all keyframe boundaries,
it bounds angular speed and each joint's lever arm to the hulls, then pads the
midpoint collision queries by the maximum relative motion to either interval
edge (at most 4 mm per query). Common-ancestor rigid transforms cancel from
relative clearance. Thus two clear endpoints cannot authorize a crossing path.
Joint sliders validate the path from the last accepted pose before displaying
the target. Custom scripts, imports, downloads and preset playback use the same
checker in a Web Worker; rejection preserves the previous valid pose/script.

`scripts/plan-rob-hello.mjs` uses position-only damped least-squares IK with joint
bounds and collision rejection. The previous overhead pose is a redundancy seed,
not a shifted joint zero. Six targets at Z=1.42 m and Y=0.38–0.46 m produce the
wave; each solves within 2 mm in the model. The full raise/wave/return passes
the swept clearance check separately. This browser preview uses its own solver,
not Drake, and creates no robot command. `gesture-review.json` records the
source model hash, constraints, IK residuals, path checks and pending gesture.
Portable GLB clips are prechecked, but the GLB carries no active collision guard.

For the later hardware planner, Drake supports
[constrained IK](https://drake.mit.edu/doxygen_cxx/group__planning__kinematics.html)
and [minimum-distance constraints](https://drake.mit.edu/doxygen_cxx/classdrake_1_1multibody_1_1_minimum_distance_lower_bound_constraint.html).
Neither endpoint IK nor this limited scan check replaces full-body path and
physical cable-clearance commissioning.

## Curb rehearsal

The example uses a **12 cm illustrative platform**, not an established
climbing capability. Its eight stages align, press the flipper wheels into the
ground, advance over the lip, seat the front tread, verify brake hold, swing
the flippers fully behind ROB, advance with rear support, and stow/settle.

Version 2 sequence scripts specify joint targets, maximum drive distances and
contact checkpoints. Authored world height/pitch is rejected. A planar
quasi-static solver derives chassis height and pitch from reviewed wheel radii,
flipper FK and a sampled rubber-belt envelope. It minimizes support-center
height subject to terrain separation. An airborne roller cannot lift the base;
continued rotation after wheel contact pitches it about its other support.
Drive sweeps stop at a blocking curb face instead of teleporting onto the deck.
The full backward sweep must make rear-wheel contact before advancing.
Contact values come from the same geometry as the displayed wheel centers.

This is a contact-constrained preview, not a mass/friction/torque simulator.
The support-center proxy is not ROB's measured center of mass. Belt samples are
at most 10 mm apart; contact tolerance is 1 mm. Roll, arm/body collisions,
traction, dynamic stability, suspension, brake force and tipping are not
validated. The curb sequence requires matching left/right flipper targets. Curb scripts
may move only the flippers, torso lean and torso yaw; arm/head motions belong
in the clearance-checked gesture editor.
Physical limits, calibration and controller authorization remain pending.

Collision terminology reference: [Box2D collision geometry](https://box2d.org/documentation/md_collision.html).
This page uses its own limited geometric solver, not the Box2D engine.

Each step has confirmations before, during and after it. Simulation can
provide synthetic acknowledgments or pause for explicit checkpoint confirmation.
Neither path can override a missing geometric contact or make a false support
condition true. Legacy version 1 curb storyboards must be replaced with the new
contact-driven script; version 1 ordinary gesture scripts remain compatible.
These controls are plainly labeled as simulated evidence. Tracking loss,
operator release, rollback, failed/unconfirmed brake hold, lost support, a
blocked drive path or confirmation timeout latches an abort. Restoring a
signal does not restart a failed rehearsal. No drive distance is permitted
while the step requests brake hold. Logs identify synthetic observations and
always export hardwareAuthorized false.

To investigate eventual controller authorization:

1. Identify what the tread brake command actually does and measure its holding
   ability on an incline, including power loss and stopping/settling behavior.
   An electrical brake command is not itself evidence of stable support.
2. Calibrate flipper directions, cable-safe arm intervals, startup references,
   LACT linkage/limits, loaded chassis geometry, camera extrinsics, and tool
   stow positions. Establish a conservative payload, slope and curb envelope.
3. Define measured guards: fresh pose, tread/platform contact, stable support,
   rollback, pitch/roll and full platform occupancy. Use calibrated vision and
   other verified sensors as available, with explicit freshness and uncertainty.
4. Validate the full swept path, contact forces, stability and recovery on a
   supported low test platform. Inject tracking, brake and communications faults
   in replay before physical reliance. Never use a failed motion as permission
   to auto-reverse or automatically cut power to a gravity-loaded mechanism.
5. Only then add a robot-side reviewed gesture registry bound to script/model/
   calibration hashes and tested limits. A controller may request an approved
   gesture with a fresh operator lease and hold-to-run control. The robot must
   reject stale references or missing guards and execute its tested stop/hold
   policy on cancellation. Editing a script invalidates that approval.

The present page cannot grant that approval, install a boot model or execute
robot commands. Cerebro and ROBController are unchanged.

## Reproduce and validate

After updating the rig JSON, run:

    node scripts/plan-rob-hello.mjs
    node scripts/export-rob-gesture-assets.mjs
    node --test tests/rob-gestures.test.mjs
    npm run build
    npm run validate
    npm run validate:subpath

Tests compare browser FK to the independent Drake handoff, validate provisional
arm preview bounds and interpolation, hold joints through failures, exercise checkpoint
timeouts, confirm no lift before roller contact, block unsupported curb drive,
check the full curb path for terrain penetration, require real simulated rear
support, check centered zeros, reject head-crossing paths and unreachable IK targets,
check the overhead wave and worker failures, parse the GLB, and verify asset hashes.
The manifest identifies the actual generated files.
