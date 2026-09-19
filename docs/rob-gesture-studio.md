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
interpolated angular speed/acceleration. B1 joints are capped at ±8° around the
reviewed pose. This provisional simulation cap is not a measured cable-safe
range. Angles are unwrapped; a 360° request is rejected, not normalized to zero.

Five starter clips are included: Curious glance, A thoughtful nod, A small
hello, Listening and Ready to help. The GLB download includes the same 43
segments and five sampled clips. Root conversion makes the portable GLB Y-up;
the browser rig and calibration stay X-forward, Y-ROB-left, Z-up.

## Curb rehearsal

The example uses a **12 cm illustrative platform**, not an established
climbing capability. Its seven steps are alignment, flipper placement, front
tread mounting, brake verification, flipper transfer, slow advance/leveling
and final hold. The base position/pitch path is authored, not solved by a
physics engine; successful playback proves no traction or stability claim.
The six tread wheels rotate independently of the flippers using their reviewed
radii and the illustrative forward distance. The tread belt itself does not deform.

Each step has confirmations before, during and after it. Simulation can
provide synthetic confirmations or pause for explicit checkpoint confirmation.
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

    node scripts/export-rob-gesture-assets.mjs
    node --test tests/rob-gestures.test.mjs
    npm run build
    npm run validate
    npm run validate:subpath

Tests compare browser FK to the independent Drake handoff, validate arm cable
bounds and interpolation, hold joints through failures, exercise checkpoint
timeouts, parse the GLB and its animations, and verify packaged asset hashes.
The manifest identifies the actual generated files.
