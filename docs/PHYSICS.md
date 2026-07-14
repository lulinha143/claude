# Physics Design

Physics is the core toy. Furniture are `RigidBody3D`s; players are
`CharacterBody3D`s; carrying is **force-based**, never teleport-based.

## Grabbing & carrying

- Each player has two "hands". Grabbing raycasts from the camera; on hit it
  claims the **nearest free grip point** on the furniture and registers a grabber
  with a *target getter* callable (the hand's world position).
- Each physics tick, `FurnitureController._apply_grab_forces()` applies, per
  grabber, a spring toward the target minus velocity damping **at the grip
  point** (`apply_force(force, grip_offset)`). Multiple grabbers (multiple hands
  or multiple players) sum naturally, so two players lifting one sofa is emergent,
  not special-cased.
- Forces are clamped (`Balance.GRAB_MAX_FORCE`) and grabs auto-release beyond
  `GRAB_BREAK_DISTANCE` to prevent physics explosions / stuck states.

## Weight & carriers

`FurnitureData.weight` sets `mass`; `min_carriers` communicates how many movers
are really needed. Heavy items barely move with one grabber and lift cleanly with
enough force contributors — the design intent without hard gating.

## Safety systems

- **Velocity clamping** to `MAX_LINEAR_VELOCITY` / `MAX_ANGULAR_VELOCITY` stops
  destructive speeds.
- **Out-of-bounds recovery**: objects below `OUT_OF_BOUNDS_Y` teleport to the
  level's recovery point, zero velocity, and gain a little arousal (they didn't
  enjoy that).
- **Physics sleep** enabled; grabs wake bodies.
- **Continuous collision detection** on furniture and fast props.

## Doors

`DoorController` builds a static frame + a hinged `RigidBody3D` panel with a
`HingeJoint3D` (limited swing). Interaction applies a torque impulse; a hard
enough impact (e.g. a shoved fridge) **breaks** the door — detaching the hinge
and failing the "no broken doors" objective.

## Van loading

`Van` uses an `Area3D` cargo zone. A target furniture that **rests** (low
velocity) inside for ~0.6 s is marked loaded. This is what the completion check
and the integration test exercise.

## Accessibility / assist

- **Physics assistance** increases grab spring/force so objects follow hands more
  forgivingly.
- **Simplified grabbing / auto-hold / one-button two-hand carry** options exist
  in Settings to reduce dexterity load. Difficulty settings never override these.

## Networking & physics

Only the authority simulates furniture; remotes interpolate toward synced
transforms. Authority transfer for grabbed objects is coordinated via the typed
message channel (see `docs/MULTIPLAYER.md`).
