import { z } from 'zod';
import { EVENT_HISTORY_SIZE, SAVE_VERSION } from '../sim/config';

// Zod schema for the persisted GameState. Defaults are set generously so a save
// is NEVER rejected because one optional property is missing — missing fields
// are filled in, which also doubles as lightweight forward-migration.

const resourceSchema = z.object({
  nuts: z.number().finite().nonnegative().catch(0),
  goldenNuts: z.number().finite().nonnegative().catch(0),
  permanentKernels: z.number().finite().nonnegative().catch(0),
  morale: z.number().finite().catch(70),
  reputation: z.number().finite().nonnegative().catch(0),
});

const employeeSchema = z.object({
  hired: z.boolean().catch(false),
  level: z.number().int().nonnegative().catch(0),
  friendship: z.number().min(0).max(100).catch(0),
  outfitId: z.string().nullable().catch(null),
  nickname: z.string().nullable().catch(null),
  room: z.string().nullable().catch(null),
  x: z.number().catch(0.2),
  emotion: z
    .object({ id: z.string(), until: z.number().nullable().catch(null) })
    .nullable()
    .catch(null)
    .optional(),
  // Conversation memory. Every field carries its own `.catch` so a partially written
  // record degrades to "never talked" rather than failing the whole save — and note
  // the schema has no `.passthrough()`, so this MUST be declared or it is stripped on
  // every load and no conversation would ever be remembered.
  talks: z
    .object({
      count: z.number().int().nonnegative().catch(0),
      lastAt: z.number().nonnegative().catch(0),
      seen: z.record(z.number()).catch({}),
    })
    .catch({ count: 0, lastAt: 0, seen: {} })
    .optional(),
});

/** A list of ids: non-strings are dropped and repeats collapse, so nothing counts twice. */
function idList(fallback: string[]) {
  return z
    .array(z.unknown())
    .catch(fallback)
    .transform((items) => [
      ...new Set(items.filter((item): item is string => typeof item === 'string' && item !== '')),
    ]);
}

const momentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  employeeId: z.string().nullable(),
  caption: z.string(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']).catch('common'),
  createdAt: z.number(),
});

const dailyChallengeSchema = z.object({
  id: z.string(),
  goal: z.number(),
  progress: z.number().catch(0),
  claimed: z.boolean().catch(false),
});

const officeFindSchema = z.object({
  id: z.string().min(1),
  employeeId: z.string().min(1),
  roomId: z.string().min(1),
  kind: z.enum(['operational', 'social', 'analytical', 'industrial', 'secure', 'irregular']),
  createdAt: z.number().finite(),
  noteKey: z.string().optional().catch(undefined),
});

const decorationInstanceSchema = z
  .object({
    instanceId: z.string().min(1),
    decorationId: z.string().min(1),
    roomId: z.string().nullable().catch(null),
    surfaceType: z.enum(['floor', 'wall', 'ceiling']).catch('floor'),
    regionKind: z.enum(['floor', 'wall', 'ceiling']).optional().catch(undefined),
    normalizedX: z.number().min(0).max(1).catch(0.5),
    normalizedY: z.number().min(0).max(1).catch(0.1),
    depth: z.number().finite().catch(0),
    layer: z.enum(['front', 'back']).optional().catch(undefined),
    variantId: z.string().optional().catch(undefined),
    flipped: z.boolean().optional().catch(undefined),
    rotation: z.number().finite().optional().catch(undefined),
    interactionState: z.record(z.unknown()).optional().catch(undefined),
  })
  .passthrough();

const settingsSchema = z
  .object({
    language: z.string().catch('en'),
    masterMuted: z.boolean().catch(false),
    channelMuted: z
      .object({
        music: z.boolean().catch(false),
        ambience: z.boolean().catch(false),
        ui: z.boolean().catch(false),
        sfx: z.boolean().catch(false),
      })
      .catch({ music: false, ambience: false, ui: false, sfx: false }),
    muteWhenUnfocused: z.boolean().catch(false),
    volumes: z
      .object({
        master: z.number().catch(0.8),
        music: z.number().catch(0.5),
        ambience: z.number().catch(0.5),
        ui: z.number().catch(0.8),
        sfx: z.number().catch(0.8),
      })
      .catch({ master: 0.8, music: 0.5, ambience: 0.5, ui: 0.8, sfx: 0.8 }),
    reducedMotion: z.boolean().catch(false),
    disableShake: z.boolean().catch(false),
    disableFlashing: z.boolean().catch(false),
    highContrast: z.boolean().catch(false),
    colorblindMode: z.enum(['off', 'deuteranopia', 'protanopia', 'tritanopia']).catch('off'),
    dyslexiaFont: z.boolean().catch(false),
    fontScale: z.number().catch(1),
    uiScale: z.number().catch(1),
    subtitles: z.boolean().catch(false),
    quietMode: z.boolean().catch(false),
    pauseAnimationsInMenus: z.boolean().catch(false),
    fpsLimit: z.union([z.literal(30), z.literal(60)]).catch(60),
    autoResolveEvents: z.boolean().catch(false),
    focusHarvestEnabled: z.boolean().catch(false),
    offlineCapHours: z.number().catch(8),
    showHints: z.boolean().catch(true),
    officeFloor: z.string().nullable().catch(null),
    background: z
      .object({
        enabled: z.boolean().catch(true),
        brightness: z.number().catch(1),
        contrast: z.number().catch(1),
        saturation: z.number().catch(1),
        blurBehindPanels: z.boolean().catch(true),
        quality: z.enum(['high', 'balanced', 'static']).catch('high'),
        focal: z.enum(['center', 'top', 'bottom', 'left', 'right']).catch('center'),
        pauseWhenHidden: z.boolean().catch(true),
      })
      .catch({
        enabled: true,
        brightness: 1,
        contrast: 1,
        saturation: 1,
        blurBehindPanels: true,
        quality: 'high',
        focal: 'center',
        pauseWhenHidden: true,
      }),
  })
  .default({})
  .catch({} as never);

export /**
 * One authored effect inside a promised consequence. Kept permissive
 * (`passthrough`) so a save written by a newer build that added an effect field
 * survives a downgrade instead of having its promises silently dropped.
 */
const effectSchema = z
  .object({
    type: z.string(),
  })
  .passthrough();

/** One room's routine (see content/roomPlay.ts). Every field optional; junk is dropped. */
const roomPlaySchema = z.object({
  startedAt: z.number().finite().optional().catch(undefined),
  readyAt: z.number().finite().optional().catch(undefined),
  jamAt: z.number().finite().optional().catch(undefined),
  taps: z.number().finite().nonnegative().optional().catch(undefined),
  blipAt: z.number().finite().optional().catch(undefined),
  blipUntil: z.number().finite().optional().catch(undefined),
  parcelAt: z.number().finite().optional().catch(undefined),
  parcelFor: z.string().optional().catch(undefined),
  mode: z.string().optional().catch(undefined),
  done: z.number().finite().nonnegative().optional().catch(undefined),
});

const officeOdditySchema = z.object({
  id: z.string(),
  roomId: z.string(),
  at: z.number().finite(),
});

const scheduledConsequenceSchema = z.object({
  id: z.string(),
  at: z.number().finite(),
  sourceEventId: z.string(),
  titleKey: z.string(),
  bodyKey: z.string(),
  effects: z.array(effectSchema),
  quiet: z.boolean().optional().catch(undefined),
});

const pendingIncidentSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  roomId: z.string(),
  employeeId: z.string().optional().catch(undefined),
  at: z.number().finite(),
  until: z.number().finite(),
});

const pendingRemarkSchema = z.object({
  employeeId: z.string(),
  key: z.string(),
  at: z.number().finite(),
});

const diaryEntrySchema = z.object({
  at: z.number().finite(),
  kind: z.enum(['incident', 'opened', 'handled', 'faded', 'moment', 'landed', 'remark']),
  eventId: z.string().optional().catch(undefined),
  momentId: z.string().optional().catch(undefined),
  roomId: z.string().optional().catch(undefined),
  employeeId: z.string().optional().catch(undefined),
});

/**
 * A decision in the company's history. `by` and `roomId` came with the observation
 * report: older saves have neither (the decision is then told without saying who
 * took it), and a value that does not parse is dropped, never the record.
 */
const eventHistoryEntrySchema = z.object({
  eventId: z.string(),
  choiceId: z.string(),
  at: z.number().finite(),
  by: z.enum(['player', 'team']).optional().catch(undefined),
  roomId: z.string().max(80).optional().catch(undefined),
});

/** Validate a list item by item, dropping what does not parse and keeping the newest `max`. */
function listOf<T extends z.ZodTypeAny>(item: T, max: number) {
  return z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .map((value) => item.safeParse(value))
        .filter((r): r is z.SafeParseSuccess<z.infer<T>> => r.success)
        .map((r) => r.data as z.infer<T>)
        .slice(-max),
    );
}

type ScheduledParsed = z.infer<typeof scheduledConsequenceSchema>;

export const gameStateSchema = z.object({
  version: z.number().catch(SAVE_VERSION),
  createdAt: z.number().catch(() => Date.now()),
  lastSaved: z.number().catch(() => Date.now()),
  company: z
    .object({
      name: z.string().catch('Nutshell Inc.'),
      icon: z.string().optional().catch(undefined),
    })
    .catch({ name: 'Nutshell Inc.', icon: 'paw' }),
  resources: resourceSchema,
  employees: z.record(employeeSchema).catch({}),
  upgrades: z.record(z.number()).catch({}),
  achievements: z.record(z.number()).catch({}),
  placements: z
    .record(
      z
        .object({
          surface: z.enum(['floor', 'wall', 'ceiling']).catch('floor'),
          x: z.number().catch(0.5),
          y: z.number().catch(0.1),
        })
        .catch({ surface: 'floor', x: 0.5, y: 0.06 }),
    )
    .catch({}),
  decorationInstances: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = decorationInstanceSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  // Each list is read entry by entry: one malformed item drops that item, not
  // everything the player ever collected, and a repeated id counts once.
  collections: z
    .object({
      nuts: idList([]),
      outfits: idList(['pip-classic']),
      logos: idList(['default']),
      moments: z
        .array(z.unknown())
        .catch([])
        .transform((items) => {
          const seen = new Set<string>();
          return items.flatMap((item) => {
            const parsed = momentSchema.safeParse(item);
            if (!parsed.success || seen.has(parsed.data.id)) return [];
            seen.add(parsed.data.id);
            return [parsed.data];
          });
        }),
      secrets: idList([]),
    })
    .catch({ nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] }),
  prestige: z
    .object({
      nutsAtLastPrestige: z.number().finite().nonnegative().catch(0),
      count: z.number().catch(0),
      branch: z
        .enum(['industrial', 'cooperative', 'science', 'marketing', 'underground'])
        .nullable()
        .catch(null),
      skills: z.record(z.number()).catch({}),
    })
    .catch({ count: 0, branch: null, skills: {}, nutsAtLastPrestige: 0 }),
  focus: z
    .object({
      active: z.boolean().catch(false),
      endsAt: z.number().catch(0),
      durationSeconds: z.number().catch(0),
      completedSessions: z.number().catch(0),
    })
    .catch({ active: false, endsAt: 0, durationSeconds: 0, completedSessions: 0 }),
  daily: z
    .object({ date: z.string(), challenges: z.array(dailyChallengeSchema) })
    .catch({ date: '', challenges: [] }),
  stats: z
    .object({
      totalNutsEarned: z.number().catch(0),
      totalClicks: z.number().catch(0),
      cratesCollected: z.number().catch(0),
      playTimeSeconds: z.number().catch(0),
      eventsSeen: z.number().catch(0),
      microgamesPlayed: z.number().catch(0),
      highestNutsPerSecond: z.number().catch(0),
      prestiges: z.number().catch(0),
    })
    .catch({
      totalNutsEarned: 0,
      totalClicks: 0,
      cratesCollected: 0,
      playTimeSeconds: 0,
      eventsSeen: 0,
      microgamesPlayed: 0,
      highestNutsPerSecond: 0,
      prestiges: 0,
    }),
  clicker: z
    .object({
      stationTaps: z.record(z.number().finite().nonnegative()).catch({}),
      criticalTaps: z.number().finite().nonnegative().catch(0),
      goldenTaps: z.number().finite().nonnegative().catch(0),
      bestStreak: z.number().finite().nonnegative().catch(0),
      rushes: z.number().finite().nonnegative().catch(0),
      findsCollected: z.number().finite().nonnegative().catch(0),
      goldenDust: z.number().finite().min(0).max(1).catch(0),
      premiumAt: z.record(z.number().finite()).catch({}),
    })
    .catch({
      stationTaps: {},
      criticalTaps: 0,
      goldenTaps: 0,
      bestStreak: 0,
      rushes: 0,
      findsCollected: 0,
      goldenDust: 0,
      premiumAt: {},
    }),
  crate: z.object({ nuts: z.number().finite().nonnegative().catch(0) }).catch({ nuts: 0 }),
  finds: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .map((item) => officeFindSchema.safeParse(item))
        .filter((r): r is { success: true; data: z.infer<typeof officeFindSchema> } => r.success)
        .map((r) => r.data)
        .slice(0, 6),
    ),
  // The rooms' routines and waiting curiosities. Older saves have none, and a bad
  // entry costs only that entry.
  office: z
    .object({
      rooms: z
        .record(z.unknown())
        .catch({})
        .transform((rooms) =>
          Object.fromEntries(
            Object.entries(rooms)
              .map(([roomId, value]) => [roomId, roomPlaySchema.safeParse(value)] as const)
              .filter(([, parsed]) => parsed.success)
              .map(([roomId, parsed]) => [
                roomId,
                (parsed as { success: true; data: z.infer<typeof roomPlaySchema> }).data,
              ]),
          ),
        ),
      oddities: z
        .array(z.unknown())
        .catch([])
        .transform((items) =>
          items
            .map((item) => officeOdditySchema.safeParse(item))
            .filter(
              (r): r is { success: true; data: z.infer<typeof officeOdditySchema> } => r.success,
            )
            .map((r) => r.data)
            .slice(0, 4),
        ),
    })
    .catch({ rooms: {}, oddities: [] }),
  // What is happening in the office, what someone has to say, and the diary.
  // Older saves have none; a bad entry costs only that entry.
  happenings: z
    .object({
      incidents: listOf(pendingIncidentSchema, 4),
      remarks: listOf(pendingRemarkSchema, 12),
      diary: listOf(diaryEntrySchema, 60),
      sinceRare: z.number().finite().nonnegative().catch(0),
    })
    .catch({ incidents: [], remarks: [], diary: [], sinceRare: 0 }),
  settings: settingsSchema,
  onboardingComplete: z.boolean().catch(false),
  eventCooldowns: z.record(z.number()).catch({}),
  pendingChain: z.object({ eventId: z.string(), step: z.number() }).nullable().catch(null),
  eventInProgress: z
    .object({
      eventId: z.string(),
      step: z.string().nullable(),
      roomId: z.string().optional().catch(undefined),
      employeeId: z.string().optional().catch(undefined),
    })
    .nullable()
    .catch(null),
  boosts: z
    .array(
      z.object({
        multiplier: z.number().finite().min(1).max(10),
        endsAt: z.number().finite(),
        // Optional and forgiving: saves from before tagged boosts simply have none.
        source: z.string().max(40).optional().catch(undefined),
      }),
    )
    .max(64)
    .catch([]),
  microgames: z
    .record(
      z.object({
        best: z.number().finite().nonnegative().catch(0),
        plays: z.number().finite().nonnegative().catch(0),
        lastRewardAt: z.number().finite().nonnegative().catch(0),
      }),
    )
    .catch({}),
  // Entry by entry: one bad record (or a bad optional field) must not wipe the
  // whole history, which the timeline and the observation report read.
  eventHistory: listOf(eventHistoryEntrySchema, EVENT_HISTORY_SIZE),
  /** Consequence memory: flagId -> epoch ms it was set. */
  flags: z.record(z.number().finite()).catch({}),
  /**
   * Promised consequences awaiting their moment. Individually validated and bad
   * entries dropped, matching the decorationInstances convention: one malformed
   * promise must not cost the player their whole save.
   */
  scheduled: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .map((item) => scheduledConsequenceSchema.safeParse(item))
        .filter((r): r is { success: true; data: ScheduledParsed } => r.success)
        .map((r) => r.data),
    ),
});

export type ParsedGameState = z.infer<typeof gameStateSchema>;
export type { ScheduledParsed };
