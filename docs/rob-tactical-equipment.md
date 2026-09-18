# ROB tactical campaign equipment

Ruleset `2026.09.17.3` is shared by the browser and native games. Jammer costs 1,800 skill points after Level 5; the premium StrikeForce Gel Kit + PEQ costs 6,000 after Level 10. Both are one-time earned upgrades, cleared with the other upgrades on a failed three-life trial.

J toggles Jammer (14 E/s, no idle recharge, automatic shutdown on depletion or lost input). Basic robots and camera signals inside 8 browser arena units are scrambled; boss and mini-boss robots resist. Native arena distances use half those units.

T draws/stows the two-handed gel kit, Q holds fire (3 E, 2 damage, 0.22-second interval), and V cycles off/blue laser/IR target view/flashlight. Touch controls and D-pad up/left/right expose the same actions. Leaning, carrying, hacking and melee stow the kit. The PEQ's infrared mode outlines nearby visible targets rather than drawing a visible infrared beam through walls.

An amber remote relay by the first cell releases the door's access lock and awards 400 score plus 60 skill points once per attempt. Swept collision checks stop pellets at the first wall, robot or relay. Existing campaign completion objectives remain required.

`build-rob-tactical-model.py` generates original simplified geometry: olive JM010-style body with sixteen upright antennas clipped outside the white router backpack, a short StrikeForce-style body, an ACTIONUNION PEQ-style module, and bent B1 arm links with the right hand at the rear grip and the left arm across the chest at the front. Generated parts are shared with native `Shared/Resources/rob-tactical-model.json` via the script's `--native-resources` argument. These are game presentation assets, not physical mounts, weapon specifications or calibrated URDF geometry. AutoNet and physical radios are unaffected.

Visual references: [JM010](https://jammermaster.com/product/mobile-phone-signal-jammer-jm010/), [Umarex StrikeForce](https://www.umarexusa.com/2252132). Umarex identifies its real product as a .177 BB model; the game uses fictional gel pellets. The requested blue/IR/flashlight combination is simulated without making vendor performance claims.
