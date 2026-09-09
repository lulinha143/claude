import type {
  DecorationSurfaceType,
  EmployeeMood,
  EventRarity,
  PrestigeBranchId,
  ResourceId,
} from '../sim/types';
import type { PlacementRegionKind } from '../sim/placementRegions';

// Content DEFINITIONS. Everything here is static data describing the game's
// catalogue. Runtime/persisted progress lives in `GameState` and references
// these by id. Adding content = adding an entry to one of these arrays.

export interface EmployeePassive {
  // Structured so the economy layer can apply it without any per-employee code.
  type:
    | 'globalMultiplier' // +x% to all nut production
    | 'selfMultiplier' // +x% to this employee's production
    | 'moraleBonus' // flat morale added
    | 'costReduction' // -x% building/upgrade costs
    | 'rareChance' // +x% rare event chance
    | 'reputationGain' // +x reputation/min
    | 'resourceFind'; // +x% chance to find bonus nuts on collect
  base: number;
  perLevel: number;
}

export interface OutfitDef {
  id: string;
  nameKey: string;
  cost: { resource: ResourceId; amount: number };
  /** color override applied to the SVG accent in the office scene. */
  accent: string;
}

export interface EmployeeDef {
  id: string;
  /** short display name (used everywhere in the UI). */
  nameKey: string;
  /** full character name (shown on the employee profile card). */
  fullNameKey: string;
  roleKey: string;
  storyKey: string;
  /** the employee's personal goal, shown on the profile for personality. */
  goalKey: string;
  /** primary body color for the generated SVG silhouette. */
  color: string;
  accent: string;
  /** nuts/second contributed per level once hired. */
  baseRate: number;
  hireCost: { resource: ResourceId; amount: number };
  /** geometric cost growth per owned level. */
  levelCostMult: number;
  unlock: { reputation?: number; prestige?: number };
  passive: EmployeePassive;
  favoriteItemKey: string;
  rareEventId: string;
  outfits: OutfitDef[];
  dialogueCategory: string;
  /** which office room the employee stands in. */
  room: string;
}

export interface RoomDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** floor index from the ground up; drives the vertical office layout. */
  floor: number;
  unlock: { upgradeId?: string; reputation?: number };
}

export interface UpgradeDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** optional interpolation values for the name/description (e.g. tier number). */
  nameParams?: Record<string, string | number>;
  category: 'production' | 'automation' | 'furniture' | 'room' | 'coffee' | 'quality';
  resource: ResourceId;
  baseCost: number;
  costMult: number;
  maxLevel: number;
  /** what one level of this upgrade does. */
  effect:
    | { kind: 'globalMultiplier'; perLevel: number }
    | { kind: 'clickPower'; perLevel: number }
    | { kind: 'moraleCap'; perLevel: number }
    | { kind: 'offlineCapHours'; perLevel: number }
    | { kind: 'autoCollect'; perLevel: number }
    | { kind: 'reputationRate'; perLevel: number }
    | { kind: 'unlockRoom'; roomId: string };
  unlock?: { reputation?: number; prestige?: number; upgradeId?: string };
}

export interface EventChoice {
  id: string;
  labelKey: string;
  effects: EventEffect[];
  /** optional next step id for multi-step chains. */
  next?: string;
  /** optional localization keys for employee reactions shown on the result panel. */
  reactions?: string[];
  /** optional gating so a choice can require a resource/employee/etc. */
  requires?: {
    nuts?: number;
    goldenNuts?: number;
    reputation?: number;
    hiredEmployee?: string;
    /** only offer this choice once the company has left this mark. */
    flag?: string;
  };
  /** optional localization key describing why a disabled choice is unavailable. */
  disabledKey?: string;
}

export interface EventEffect {
  type:
    | 'nuts'
    | 'goldenNuts'
    | 'morale'
    | 'reputation'
    | 'productionBoost' // temporary multiplier
    | 'friendship'
    | 'emotion' // set a specific employee's emotion (optionally temporary)
    | 'momentCard'
    | 'setFlag' // leave a durable mark later content can read
    | 'clearFlag'
    | 'schedule' // promise effects that land later
    | 'unlockSecret'
    | 'collectNut';
  value?: number;
  durationSeconds?: number;
  employeeId?: string;
  /** for `emotion` effects: the emotion to apply to `employeeId`. */
  emotion?: EmployeeMood;
  nutId?: string;
  secretId?: string;
  /** for `setFlag` / `clearFlag`: the consequence-memory mark to write. */
  flagId?: string;
  /** for `schedule`: how far in the future the promised effects land. */
  delaySeconds?: number;
  /** for `schedule`: presentation for the callback notice when it fires. */
  scheduleTitleKey?: string;
  scheduleBodyKey?: string;
  /** for `schedule`: the effects to apply then. */
  scheduled?: EventEffect[];
}

export interface GameEventDef {
  id: string;
  titleKey: string;
  bodyKey: string;
  rarity: EventRarity;
  weight: number;
  cooldownSeconds: number;
  requires?: {
    reputation?: number;
    hiredEmployee?: string;
    prestige?: number;
    /** only offer this event once the company has left this mark. */
    flag?: string;
    /** only offer this event while the company has NOT left this mark. */
    missingFlag?: string;
    /** only offer this event once the named room is unlocked. */
    room?: string;
    /** only offer this event while morale is at or below this value. */
    moraleBelow?: number;
    /** only offer this event while morale is at or above this value. */
    moraleAbove?: number;
  };
  employeeId?: string | null;
  choices: EventChoice[];
  /** true when this event is worth a shareable Moment Card automatically. */
  momentWorthy?: boolean;
  /** chain steps keyed by step id, used by multi-step events. */
  steps?: Record<string, { bodyKey: string; choices: EventChoice[] }>;
}

export interface AchievementDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  hidden?: boolean;
  goldenReward: number;
  condition:
    | { kind: 'totalNuts'; value: number }
    | { kind: 'nutsPerSecond'; value: number }
    | { kind: 'clicks'; value: number }
    | { kind: 'employeesHired'; value: number }
    | { kind: 'prestiges'; value: number }
    | { kind: 'exactNuts'; value: number }
    | { kind: 'morale'; value: number }
    | { kind: 'eventsSeen'; value: number }
    | { kind: 'microgames'; value: number }
    | { kind: 'focusSessions'; value: number }
    | { kind: 'collectionNuts'; value: number }
    | { kind: 'roomsUnlocked'; value: number }
    | { kind: 'flag'; flag: string };
}

export interface NutDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  rarity: EventRarity;
  color: string;
}

export interface DecorationDef {
  id: string;
  nameKey: string;
  cost: { resource: ResourceId; amount: number };
  moraleBonus: number;
  /** Legacy/default room used only for initial placement and old-save inference. */
  room: string;
  compatibleRooms: string[];
  /** Canonical, exclusive support for this item. Never inferred from its id. */
  placementSurface: DecorationSurfaceType;
  /** Legacy serialized support list; always contains only placementSurface. */
  compatibleSurfaces: DecorationSurfaceType[];
  /** Explicit semantic supports used by the normalized room-region model. */
  defaultRegionKind: PlacementRegionKind;
  compatibleRegionKinds: PlacementRegionKind[];
  /** Physical supports allowed by semantic regions; independent of the legacy projection. */
  compatibleRegionSurfaces: DecorationSurfaceType[];
  /** Optional room-region tags required when using a room-specific support. */
  compatibleSpecialTags?: string[];
  isStructural: boolean;
}

export interface PrestigeSkillDef {
  id: string;
  nameKey: string;
  descriptionKey: string;
  cost: number; // permanent kernels per level
  maxLevel: number;
  effect:
    | { kind: 'startNuts'; perLevel: number }
    | { kind: 'globalMultiplier'; perLevel: number }
    | { kind: 'kernelGain'; perLevel: number }
    | { kind: 'offlineCapHours'; perLevel: number }
    | { kind: 'moraleFloor'; perLevel: number };
}

export interface PrestigeBranchDef {
  id: PrestigeBranchId;
  nameKey: string;
  descriptionKey: string;
  /** multiplicative production bonus while this branch is active. */
  productionMultiplier: number;
  moraleBonus: number;
  rareEventChance: number;
}

export interface DailyChallengeTemplate {
  id: string;
  type:
    | 'produceNuts'
    | 'completeFocus'
    | 'employeeConversations'
    | 'playMicrogame'
    | 'maintainMorale'
    | 'collectCrates';
  nameKey: string;
  baseGoal: number;
  goldenReward: number;
}
