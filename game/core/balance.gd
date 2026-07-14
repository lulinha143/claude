class_name Balance
extends RefCounted
## Centralised balance/tuning numbers. Designers edit these in one place.
## No logic lives here — only tunable values with documented meaning.

# --- Player movement -------------------------------------------------------
const PLAYER_WALK_SPEED: float = 3.2
const PLAYER_SPRINT_SPEED: float = 5.4
const PLAYER_CROUCH_SPEED: float = 1.6
const PLAYER_ACCEL: float = 12.0
const PLAYER_JUMP_VELOCITY: float = 4.2
const PLAYER_MAX_STAMINA: float = 100.0
const PLAYER_STAMINA_DRAIN: float = 18.0   # per second while sprinting
const PLAYER_STAMINA_REGEN: float = 12.0   # per second while not sprinting

# --- Grabbing / carrying ---------------------------------------------------
const GRAB_REACH: float = 2.2
const GRAB_SPRING: float = 90.0            # force multiplier toward hold target
const GRAB_DAMP: float = 12.0              # velocity damping on held bodies
const GRAB_MAX_FORCE: float = 4000.0       # clamp to avoid physics explosions
const GRAB_BREAK_DISTANCE: float = 3.2     # auto-release if stretched too far
const CARRY_ROTATE_SPEED: float = 2.5

# --- Physics safety --------------------------------------------------------
const MAX_LINEAR_VELOCITY: float = 24.0    # clamp destructive speeds
const MAX_ANGULAR_VELOCITY: float = 18.0
const OUT_OF_BOUNDS_Y: float = -40.0       # below this = recover object

# --- Property instability --------------------------------------------------
## Instability points required to reach each named level.
const INSTABILITY_THRESHOLDS: Array[int] = [0, 25, 50, 75, 100]
const INSTABILITY_MAX: int = 120
const INSTABILITY_PASSIVE_RATE: float = 0.4  # points/sec just for being present

# --- Rewards ---------------------------------------------------------------
const REWARD_PERFECT_MULT: float = 1.5
const REWARD_DAMAGE_PENALTY: float = 0.6   # fraction of item value lost when broken
const INSURANCE_MAX: int = 5
const INSURANCE_MIN: int = 0

# --- Emotions --------------------------------------------------------------
## Base decay (per second) pulling an object's arousal back toward calm.
const EMOTION_DECAY: float = 3.0
## Arousal thresholds that promote an object to more intense emotional states.
const AROUSAL_NERVOUS: float = 20.0
const AROUSAL_AGITATED: float = 55.0
const AROUSAL_PANIC: float = 85.0
const AROUSAL_MAX: float = 100.0
