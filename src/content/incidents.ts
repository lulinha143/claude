import type { EventChoice, EventEffect, GameEventDef } from './types';

// This chapter's incidents: things that happen to particular people, in
// particular rooms, and that the company remembers. Each one leaves its mark
// differently: a rivalry tipped one way, a room's mode changed, someone who
// brings it up later, a follow-up that turns up on its own, a curiosity that
// appears in a room days of play later, a secret. Words live at
// `incident.<key>.*` in the locales.

const k = (id: string, rest: string) => `incident.${id}.${rest}`;

/** Something promised for later that shows up in the world, not in a notice. */
function later(seconds: number, ...effects: EventEffect[]): EventEffect {
  return { type: 'schedule', delaySeconds: seconds, quiet: true, scheduled: effects };
}

function choice(
  id: string,
  key: string,
  effects: EventEffect[],
  extra: Partial<EventChoice> = {},
): EventChoice {
  return {
    id,
    labelKey: k(key, id),
    effects,
    reactions: [k(key, `${id}Reply`)],
    ...extra,
  };
}

const flag = (flagId: string): EventEffect => ({ type: 'setFlag', flagId });
const mood = (employeeId: string, emotion: EventEffect['emotion'], seconds = 600): EventEffect => ({
  type: 'emotion',
  employeeId,
  emotion,
  durationSeconds: seconds,
});
const friends = (employeeId: string, value: number): EventEffect => ({
  type: 'friendship',
  employeeId,
  value,
});

export const INCIDENT_EVENTS: GameEventDef[] = [
  // --- rivals: Quincy found twelve bugs in Nixie's gadget ------------------------
  {
    id: 'bug-bounty',
    titleKey: k('bugBounty', 'title'),
    bodyKey: k('bugBounty', 'body'),
    hookKey: k('bugBounty', 'hook'),
    rarity: 'uncommon',
    weight: 7,
    cooldownSeconds: 4 * 3600,
    employeeId: 'quincy',
    cast: ['nixie'],
    requires: { hiredAll: ['quincy', 'nixie'] },
    choices: [
      choice('quincy', 'bugBounty', [
        friends('quincy', 6),
        friends('nixie', -3),
        mood('nixie', 'frustrated'),
        flag('bounty.quincy'),
      ]),
      choice('nixie', 'bugBounty', [
        friends('nixie', 6),
        friends('quincy', -2),
        mood('quincy', 'suspicious'),
        flag('bounty.nixie'),
      ]),
      choice('contest', 'bugBounty', [
        friends('quincy', 3),
        friends('nixie', 3),
        { type: 'productionBoost', value: 1.1, durationSeconds: 300 },
        flag('bounty.contest'),
        // The bet pays off on its own, a few minutes later, in the lab.
        later(480, { type: 'moment', momentId: 'lunch-bet' }),
      ]),
    ],
  },

  // --- rivals: Corvus wants neon, Rosa wants pink --------------------------------
  {
    id: 'the-rebrand',
    titleKey: k('rebrand', 'title'),
    bodyKey: k('rebrand', 'body'),
    hookKey: k('rebrand', 'hook'),
    rarity: 'uncommon',
    weight: 7,
    cooldownSeconds: 6 * 3600,
    employeeId: 'corvus',
    cast: ['rosa'],
    room: 'marketing',
    requires: { hiredAll: ['corvus', 'rosa'], room: 'marketing', missingFlag: 'rebrand.done' },
    choices: [
      choice('neon', 'rebrand', [
        { type: 'reputation', value: 5 },
        mood('rosa', 'sad', 900),
        mood('corvus', 'proud'),
        // The campaign the marketing floor runs follows the decision.
        { type: 'roomMode', roomId: 'marketing', mode: 'buzz' },
        flag('rebrand.neon'),
        flag('rebrand.done'),
      ]),
      choice('pink', 'rebrand', [
        { type: 'morale', value: 5 },
        mood('corvus', 'embarrassed'),
        mood('rosa', 'proud'),
        { type: 'roomMode', roomId: 'marketing', mode: 'brand' },
        flag('rebrand.pink'),
        flag('rebrand.done'),
      ]),
      choice('both', 'rebrand', [
        { type: 'reputation', value: 3 },
        { type: 'morale', value: 3 },
        mood('corvus', 'excited'),
        mood('rosa', 'excited'),
        { type: 'momentCard' },
        flag('rebrand.neonpink'),
        flag('rebrand.done'),
        later(300, { type: 'oddity', oddityId: 'neon-pink-sign' }),
      ]),
    ],
  },

  // --- rivals: two receipts, one crate ---------------------------------------------
  {
    id: 'bidding-war',
    titleKey: k('biddingWar', 'title'),
    bodyKey: k('biddingWar', 'body'),
    hookKey: k('biddingWar', 'hook'),
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 6 * 3600,
    employeeId: 'rizzo',
    cast: ['perry'],
    requires: { hiredAll: ['rizzo', 'perry'] },
    choices: [
      choice('rizzo', 'biddingWar', [
        { type: 'goldenNuts', value: 1 },
        friends('rizzo', 5),
        friends('perry', -3),
        mood('perry', 'suspicious'),
        flag('bidding.rizzo'),
      ]),
      choice('perry', 'biddingWar', [
        { type: 'goldenNuts', value: 1 },
        friends('perry', 5),
        friends('rizzo', -3),
        mood('rizzo', 'suspicious'),
        flag('bidding.perry'),
      ]),
      choice(
        'audit',
        'biddingWar',
        [
          { type: 'nuts', value: 400 },
          friends('otto', 6),
          mood('rizzo', 'embarrassed'),
          mood('perry', 'embarrassed'),
          flag('bidding.audited'),
        ],
        { requires: { hiredEmployee: 'otto' }, disabledKey: k('biddingWar', 'auditNeeds') },
      ),
    ],
  },

  // --- friends: the night shift recorded the building -----------------------------
  {
    id: 'night-shift-report',
    titleKey: k('nightShift', 'title'),
    bodyKey: k('nightShift', 'body'),
    hookKey: k('nightShift', 'hook'),
    rarity: 'rare',
    weight: 5,
    cooldownSeconds: 24 * 3600,
    employeeId: 'moss',
    cast: ['echo'],
    momentWorthy: true,
    requires: { hiredAll: ['moss', 'echo'], missingFlag: 'nightshift.done' },
    choices: [
      choice('play', 'nightShift', [
        { type: 'morale', value: 6 },
        mood('moss', 'proud', 900),
        mood('echo', 'proud', 900),
        flag('nightshift.played'),
        flag('nightshift.done'),
        later(600, { type: 'oddity', oddityId: 'night-hum-tape' }),
      ]),
      choice('secret', 'nightShift', [
        friends('moss', 6),
        friends('echo', 6),
        { type: 'unlockSecret', secretId: 'anomaly.hum' },
        flag('nightshift.secret'),
        flag('nightshift.done'),
      ]),
      { id: 'ask', labelKey: k('nightShift', 'ask'), effects: [], next: 'source' },
    ],
    steps: {
      source: {
        bodyKey: k('nightShift', 'sourceBody'),
        choices: [
          choice('leave', 'nightShift', [
            { type: 'morale', value: 4 },
            { type: 'unlockSecret', secretId: 'anomaly.hum' },
            flag('nightshift.source'),
            flag('nightshift.done'),
          ]),
          choice(
            'record',
            'nightShift',
            [
              { type: 'reputation', value: 6 },
              friends('nixie', 4),
              flag('nightshift.recorded'),
              flag('nightshift.done'),
              later(300, {
                type: 'remark',
                employeeId: 'nixie',
                lineKey: k('nightShift', 'recordLater'),
              }),
            ],
            { requires: { hiredEmployee: 'nixie' }, disabledKey: k('nightShift', 'recordNeeds') },
          ),
        ],
      },
    },
  },

  // --- awkward: the minutes are under Nino ------------------------------------------
  {
    id: 'the-minutes',
    titleKey: k('minutes', 'title'),
    bodyKey: k('minutes', 'body'),
    hookKey: k('minutes', 'hook'),
    rarity: 'common',
    weight: 7,
    cooldownSeconds: 8 * 3600,
    employeeId: 'hazel',
    cast: ['nino'],
    room: 'meeting',
    requires: { hiredAll: ['hazel', 'nino'], room: 'meeting', missingFlag: 'minutes.done' },
    choices: [
      choice('wake', 'minutes', [
        mood('nino', 'frustrated'),
        friends('hazel', 4),
        { type: 'reputation', value: 2 },
        flag('minutes.woke'),
        flag('minutes.done'),
      ]),
      choice('sign', 'minutes', [
        mood('hazel', 'worried', 900),
        flag('minutes.forged'),
        flag('minutes.done'),
        // He will notice. Not now.
        later(420, { type: 'incident', eventId: 'minutes-disputed' }),
      ]),
      choice('laminate', 'minutes', [
        { type: 'morale', value: 5 },
        mood('nino', 'relaxed', 900),
        mood('hazel', 'embarrassed'),
        { type: 'momentCard' },
        flag('minutes.laminated'),
        flag('minutes.done'),
        later(240, { type: 'oddity', oddityId: 'laminated-minutes' }),
      ]),
    ],
  },
  // ...and, if Hazel signed for him, Nino eventually reads Clause 3.
  {
    id: 'minutes-disputed',
    titleKey: k('minutesDisputed', 'title'),
    bodyKey: k('minutesDisputed', 'body'),
    hookKey: k('minutesDisputed', 'hook'),
    rarity: 'uncommon',
    weight: 0,
    cooldownSeconds: 24 * 3600,
    employeeId: 'nino',
    cast: ['hazel'],
    room: 'meeting',
    requires: { flag: 'minutes.forged', missingFlag: 'minutes.settled' },
    choices: [
      choice('strike', 'minutesDisputed', [
        friends('nino', 6),
        friends('hazel', -2),
        { type: 'morale', value: 2 },
        flag('minutes.clause3'),
        flag('minutes.settled'),
      ]),
      choice('stand', 'minutesDisputed', [
        friends('hazel', 5),
        mood('nino', 'tired', 900),
        { type: 'reputation', value: 3 },
        flag('minutes.clause3Stands'),
        flag('minutes.settled'),
      ]),
    ],
  },

  // --- Sonny sleepwalked into the vault -------------------------------------------
  {
    id: 'vault-sleeper',
    titleKey: k('vaultSleeper', 'title'),
    bodyKey: k('vaultSleeper', 'body'),
    hookKey: k('vaultSleeper', 'hook'),
    rarity: 'uncommon',
    weight: 6,
    cooldownSeconds: 8 * 3600,
    employeeId: 'bia',
    cast: ['dorm'],
    room: 'vault',
    requires: { hiredAll: ['bia', 'dorm'], room: 'vault', missingFlag: 'sonny.done' },
    choices: [
      choice('let', 'vaultSleeper', [
        mood('dorm', 'relaxed', 1800),
        mood('bia', 'suspicious', 900),
        { type: 'morale', value: 3 },
        flag('sonny.vaultSleep'),
        flag('sonny.done'),
        later(600, { type: 'oddity', oddityId: 'vault-pillow' }),
      ]),
      choice('carry', 'vaultSleeper', [
        friends('bia', 5),
        friends('dorm', 3),
        { type: 'reputation', value: 2 },
        flag('sonny.carried'),
        flag('sonny.done'),
        later(300, {
          type: 'remark',
          employeeId: 'dorm',
          lineKey: k('vaultSleeper', 'carryLater'),
        }),
      ]),
      choice('official', 'vaultSleeper', [
        mood('dorm', 'proud', 900),
        friends('bia', 2),
        { type: 'morale', value: 4 },
        // A vault with a sleeper in it is a vault that keeps things.
        { type: 'roomMode', roomId: 'vault', mode: 'hoard' },
        { type: 'momentCard' },
        flag('sonny.vaultSleeper'),
        flag('sonny.done'),
      ]),
    ],
  },

  // --- the lab: the centrifuge was switched off an hour ago --------------------------
  {
    id: 'centrifuge-wont-stop',
    titleKey: k('centrifuge', 'title'),
    bodyKey: k('centrifuge', 'body'),
    hookKey: k('centrifuge', 'hook'),
    rarity: 'common',
    weight: 7,
    cooldownSeconds: 3 * 3600,
    room: 'lab',
    requires: { room: 'lab', staffed: 'lab' },
    choices: [
      choice('spin', 'centrifuge', [
        { type: 'productionBoost', value: 1.25, durationSeconds: 240 },
        { type: 'morale', value: -4 },
        { type: 'roomMood', roomId: 'lab', emotion: 'worried', durationSeconds: 600 },
        flag('centrifuge.spun'),
      ]),
      choice('unplug', 'centrifuge', [
        { type: 'morale', value: 2 },
        flag('centrifuge.unplugged'),
        later(360, { type: 'oddity', oddityId: 'still-spinning' }),
      ]),
      choice(
        'talk',
        'centrifuge',
        [
          friends('axel', 5),
          { type: 'morale', value: 5 },
          { type: 'roomMood', roomId: 'lab', emotion: 'relaxed', durationSeconds: 600 },
          flag('centrifuge.talked'),
        ],
        { requires: { hiredEmployee: 'axel' }, disabledKey: k('centrifuge', 'talkNeeds') },
      ),
    ],
  },

  // --- the cafeteria: a curiosity comes back -------------------------------------
  {
    id: 'soup-week-two',
    titleKey: k('soup', 'title'),
    bodyKey: k('soup', 'body'),
    hookKey: k('soup', 'hook'),
    rarity: 'uncommon',
    weight: 8,
    cooldownSeconds: 24 * 3600,
    employeeId: 'marlow',
    room: 'cafeteria',
    // Only once someone has noticed the soup of the week on the menu board.
    requires: {
      hiredEmployee: 'marlow',
      room: 'cafeteria',
      flag: 'oddity.soup-week',
      missingFlag: 'soup.done',
    },
    choices: [
      choice('serve', 'soup', [
        { type: 'morale', value: -3 },
        { type: 'nuts', value: 300 },
        flag('soup.served'),
        flag('soup.done'),
      ]),
      choice('name', 'soup', [
        { type: 'morale', value: 5 },
        { type: 'momentCard' },
        flag('soup.named'),
        flag('soup.done'),
        later(240, { type: 'oddity', oddityId: 'soup-name-tag' }),
      ]),
      choice(
        'compost',
        'soup',
        [
          friends('axel', 4),
          flag('soup.compost'),
          flag('soup.done'),
          later(480, { type: 'remark', employeeId: 'axel', lineKey: k('soup', 'compostLater') }),
        ],
        { requires: { hiredEmployee: 'axel' }, disabledKey: k('soup', 'compostNeeds') },
      ),
    ],
  },

  // --- the mailroom: after enough deliveries, one comes for the building ----------
  {
    id: 'parcel-for-the-tree',
    titleKey: k('treeParcel', 'title'),
    bodyKey: k('treeParcel', 'body'),
    hookKey: k('treeParcel', 'hook'),
    rarity: 'rare',
    weight: 6,
    cooldownSeconds: 48 * 3600,
    room: 'mailroom',
    momentWorthy: true,
    requires: {
      room: 'mailroom',
      roomDone: { room: 'mailroom', count: 3 },
      missingFlag: 'treeParcel.done',
    },
    choices: [
      { id: 'open', labelKey: k('treeParcel', 'open'), effects: [], next: 'inside' },
      choice('return', 'treeParcel', [
        flag('treeParcel.returned'),
        flag('treeParcel.done'),
        later(600, {
          type: 'remark',
          employeeId: 'inky',
          lineKey: k('treeParcel', 'returnLater'),
        }),
      ]),
      choice('desk', 'treeParcel', [
        { type: 'morale', value: 2 },
        flag('treeParcel.desk'),
        flag('treeParcel.done'),
        later(300, { type: 'oddity', oddityId: 'tree-parcel' }),
      ]),
    ],
    steps: {
      inside: {
        bodyKey: k('treeParcel', 'insideBody'),
        choices: [
          choice('plant', 'treeParcel', [
            { type: 'morale', value: 6 },
            { type: 'goldenNuts', value: 1 },
            flag('treeParcel.planted'),
            flag('treeParcel.done'),
          ]),
          choice('vault', 'treeParcel', [
            { type: 'goldenNuts', value: 2 },
            flag('treeParcel.vault'),
            flag('treeParcel.done'),
          ]),
        ],
      },
    },
  },

  // --- Pip's story: the first acorn's first leaf ----------------------------------
  {
    id: 'acorn-first-leaf',
    titleKey: k('firstLeaf', 'title'),
    bodyKey: k('firstLeaf', 'body'),
    hookKey: k('firstLeaf', 'hook'),
    rarity: 'rare',
    weight: 8,
    cooldownSeconds: 48 * 3600,
    employeeId: 'pip',
    room: 'founder-desk',
    momentWorthy: true,
    requires: { flag: 'pip.arc.done', missingFlag: 'acorn.leaf' },
    choices: [
      choice('party', 'firstLeaf', [
        { type: 'morale', value: 6 },
        { type: 'everyone', value: 1 },
        flag('acorn.leaf'),
        flag('acorn.party'),
      ]),
      choice('measure', 'firstLeaf', [
        friends('pip', 5),
        flag('acorn.leaf'),
        flag('acorn.measured'),
        later(900, { type: 'remark', employeeId: 'pip', lineKey: k('firstLeaf', 'measureLater') }),
      ]),
      choice(
        'axel',
        'firstLeaf',
        [friends('axel', 5), friends('pip', 3), flag('acorn.leaf'), flag('acorn.axel')],
        { requires: { hiredEmployee: 'axel' }, disabledKey: k('firstLeaf', 'axelNeeds') },
      ),
    ],
  },

  // --- a gift that changed someone's day: Pingo's scarf -------------------------
  {
    id: 'scarf-off-schedule',
    titleKey: k('scarf', 'title'),
    bodyKey: k('scarf', 'body'),
    hookKey: k('scarf', 'hook'),
    rarity: 'uncommon',
    weight: 8,
    cooldownSeconds: 24 * 3600,
    employeeId: 'junie',
    cast: ['pingo'],
    // Only after the player has given Pingo the scarf he loves.
    requires: {
      hiredAll: ['junie', 'pingo'],
      flag: 'pingo.gift.scarf',
      missingFlag: 'scarf.done',
    },
    choices: [
      choice('catwalk', 'scarf', [
        friends('pingo', 5),
        friends('junie', -2),
        mood('junie', 'frustrated'),
        { type: 'morale', value: 3 },
        flag('scarf.catwalk'),
        flag('scarf.done'),
      ]),
      choice('schedule', 'scarf', [
        friends('junie', 4),
        friends('pingo', 3),
        { type: 'productionBoost', value: 1.1, durationSeconds: 300 },
        flag('scarf.scheduled'),
        flag('scarf.done'),
      ]),
    ],
  },

  // --- the strange side: enough of the paranormal, and the building responds ------
  {
    id: 'thirteenth-button',
    titleKey: k('thirteenth', 'title'),
    bodyKey: k('thirteenth', 'body'),
    hookKey: k('thirteenth', 'hook'),
    rarity: 'legendary',
    weight: 6,
    cooldownSeconds: 72 * 3600,
    room: 'founder-desk',
    momentWorthy: true,
    requires: { flag: 'anomaly.thread', missingFlag: 'thirteenth.done' },
    choices: [
      { id: 'press', labelKey: k('thirteenth', 'press'), effects: [], next: 'floor' },
      choice('tape', 'thirteenth', [
        flag('thirteenth.taped'),
        flag('thirteenth.done'),
        later(900, { type: 'remark', employeeId: 'echo', lineKey: k('thirteenth', 'tapeLater') }),
      ]),
      choice(
        'moss',
        'thirteenth',
        [
          friends('moss', 8),
          { type: 'unlockSecret', secretId: 'anomaly.thirteenth' },
          flag('thirteenth.moss'),
          flag('thirteenth.done'),
        ],
        { requires: { hiredEmployee: 'moss' }, disabledKey: k('thirteenth', 'mossNeeds') },
      ),
    ],
    steps: {
      floor: {
        bodyKey: k('thirteenth', 'floorBody'),
        choices: [
          choice('keep', 'thirteenth', [
            { type: 'goldenNuts', value: 2 },
            { type: 'unlockSecret', secretId: 'anomaly.floorZero' },
            flag('thirteenth.pressed'),
            flag('thirteenth.done'),
            later(600, { type: 'oddity', oddityId: 'moss-by-the-lift' }),
          ]),
          choice('tell', 'thirteenth', [
            { type: 'morale', value: 8 },
            { type: 'everyone', value: 2 },
            { type: 'unlockSecret', secretId: 'anomaly.floorZero' },
            flag('thirteenth.told'),
            flag('thirteenth.done'),
          ]),
        ],
      },
    },
  },
];
