# Audio System

All audio is **synthesized at runtime** via the Web Audio API (`src/audio/audio.ts`)
— no sample files, nothing to license. Music, ambience and every SFX are built
from oscillators and filtered noise.

## Centralized bus graph

Every sound flows through a named **bus GainNode**, and every bus flows through
the single **master** node, so one node silences the whole game:

```
oscillators/sources
   ├─ musicGain    ─┐
   ├─ ambienceGain ─┤
   ├─ uiGain       ─┼─► master ─► limiter (compressor) ─► destination
   └─ sfxGain      ─┘
```

- **music / ambience** beds connect to their bus.
- **UI** sounds (`click`, `error`) connect to `uiGain`; all other SFX connect to
  `sfxGain`. Previously UI/SFX connected straight to master and only scaled gain
  per-note; now channel volume and per-channel mute are enforced **at the bus
  node**, matching the music/ambience beds.

## Master Mute (instant + authoritative)

`applyGains()` is the single place that drives bus gains. When
`flags.muted` is set (or a bus value is `0`), the bus is **hard-cut**:
`cancelScheduledValues()` + `setValueAtTime(0)` — no fade — so a click on Mute
silences anything already ringing out **immediately**. Unmuting ramps smoothly
back to the stored value with `setTargetAtTime`.

Master mute is enforced in three redundant places:

1. `effectiveMasterGain()` returns `0` → master node hard-cut to 0.
2. `channelGain()` returns `0` for every channel while muted → each bus hard-cut.
3. `play()` early-returns while muted (never even creates the nodes).

Mute never erases volumes: `volumes` and `channelMuted` are stored separately,
so unmuting restores the previous levels. Both persist in the save
(`settings.masterMuted`, `settings.channelMuted`, `settings.volumes`).

## Channels

| Bus       | Sources                                             | Controls |
| --------- | --------------------------------------------------- | -------- |
| music     | evolving cozy score                                 | volume + mute |
| ambience  | room hum + typing/paper/coffee/creak/drip one-shots | volume + mute |
| ui        | `click`, `error`                                    | volume + mute |
| sfx       | `collect`, `upgrade`, `event`, `coffee`, `celebrate`, `prestige`, `footstep` | volume + mute |

Extra global modifiers: **Quiet Mode** attenuates master ×0.25; **Focus Mode**
ducks music/ambience; **Mute-when-unfocused** and tab-hidden suspend the whole
`AudioContext` (battery-friendly).

## Diagnostics

`audio.getDiagnostics()` returns the live `AudioContext.state`, whether the beds
are playing, the current flags, the effective master gain, the effective gain of
**every bus**, and the count of **active audio sources** (live oscillators are
tracked on `start`/`ended`). The Developer Panel shows these and refreshes ~1 Hz;
every value drops to `0` the instant Master Mute is engaged, making the routing
verifiable at a glance. It works headless (no Web Audio) by reporting the pure
gain math.

## Tests

`tests/audio.test.ts`:

- Pure gain math (`effectiveMasterGain`, `channelGain`): master mute zeroes
  master + every channel; per-channel mute isolates; zero slider silences; quiet
  attenuates; focus ducks.
- `AudioManager` diagnostics (headless): master mute zeroes master **and every
  bus**; unmute restores; per-channel mute isolates one bus; `play()` / beds are
  safe no-ops with no Web Audio context.
