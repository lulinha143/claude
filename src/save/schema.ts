import { z } from 'zod';
import { SAVE_VERSION } from '../sim/config';

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
});

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
  collections: z
    .object({
      nuts: z.array(z.string()).catch([]),
      outfits: z.array(z.string()).catch([]),
      logos: z.array(z.string()).catch(['default']),
      moments: z.array(momentSchema).catch([]),
      secrets: z.array(z.string()).catch([]),
    })
    .catch({ nuts: [], outfits: [], logos: ['default'], moments: [], secrets: [] }),
  prestige: z
    .object({
      count: z.number().catch(0),
      branch: z
        .enum(['industrial', 'cooperative', 'science', 'marketing', 'underground'])
        .nullable()
        .catch(null),
      skills: z.record(z.number()).catch({}),
    })
    .catch({ count: 0, branch: null, skills: {} }),
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
    })
    .catch({ stationTaps: {}, criticalTaps: 0, goldenTaps: 0, bestStreak: 0 }),
  settings: settingsSchema,
  onboardingComplete: z.boolean().catch(false),
  eventCooldowns: z.record(z.number()).catch({}),
  pendingChain: z.object({ eventId: z.string(), step: z.number() }).nullable().catch(null),
  eventHistory: z
    .array(z.object({ eventId: z.string(), choiceId: z.string(), at: z.number() }))
    .catch([]),
});

export type ParsedGameState = z.infer<typeof gameStateSchema>;
