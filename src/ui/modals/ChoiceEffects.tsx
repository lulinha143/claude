import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChoicePreview } from '../../sim/eventChoices';
import type { GameState } from '../../sim/types';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { ROOMS_BY_ID } from '../../content/rooms';
import { MOOD_POSITIVE } from '../../sim/mood';
import { Icon, type IconName } from '../../art/UiIcon';
import { Glyph } from '../../art/Glyph';
import { STICKER_FOR_MOOD, StickerArt } from '../../art/EmotionSticker';
import { moodWord } from '../moodWord';
import { useFmt } from '../useFmt';

// What a choice on an incident card will do, in a line under its words: what it
// costs and pays, who it changes and how, the room it changes, a souvenir, who
// will remember, and whether something will come of it later. Read from the
// simulation's own preview (sim/eventChoices.ts), so it is exactly what happens.
// A secret and what was set in motion stay unsaid: only THAT something follows.
//
// Every term says it in words; a corner window keeps the same line to one row of
// marks and numbers (`short`), and the words stay in its tooltip and with a
// screen reader.

type Tone = 'gain' | 'cost' | 'people' | 'note';
type Kind = 'cost' | 'gain' | 'people' | 'room' | 'keep' | 'later';

function Term({
  tone,
  kind,
  label,
  mark,
  long,
  short,
}: {
  tone: Tone;
  /** what it is about, for the order a corner window reads them in. */
  kind: Kind;
  /** the whole sentence, for a screen reader and a pointer that rests on it. */
  label: string;
  /** the icon, sticker or glyph it starts with. */
  mark?: ReactNode;
  /** what it says in a roomy window. */
  long: ReactNode;
  /** what it says in a corner window (defaults to `long`). */
  short?: ReactNode;
}) {
  return (
    <span
      className={`choice-term choice-term--${tone}`}
      data-kind={kind}
      data-short={short !== undefined ? 'true' : undefined}
      title={label}
    >
      <span className="choice-term__shown" aria-hidden>
        {mark}
        <span className="choice-term__long">{long}</span>
        {short !== undefined ? <span className="choice-term__short">{short}</span> : null}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** "5 min" for whole minutes, else the game's own short duration. */
function shortTime(seconds: number, fallback: (s: number) => string): string {
  return seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : fallback(seconds);
}

export function ChoiceEffects({
  id,
  preview,
  state,
}: {
  id: string;
  preview: ChoicePreview;
  state: GameState;
}) {
  const { t } = useTranslation();
  const fmt = useFmt();
  const nameOf = (employeeId: string) =>
    state.employees[employeeId]?.nickname ?? t(EMPLOYEES_BY_ID[employeeId]?.nameKey ?? employeeId);
  const roomName = (roomId: string) => t(ROOMS_BY_ID[roomId]?.nameKey ?? roomId);
  const signed = (value: number) => `${value > 0 ? '+' : '-'}${fmt.num(Math.abs(value))}`;
  const heart = (value: number) => (
    <span className="choice-term__heart">
      <Glyph name="heart" size={9} />
      {signed(value)}
    </span>
  );
  const sticker = (mood: NonNullable<ChoicePreview['people'][number]['emotion']>) => (
    <span className="choice-term__sticker" data-sticker={STICKER_FOR_MOOD[mood]}>
      <StickerArt kind={STICKER_FOR_MOOD[mood]} compact />
    </span>
  );
  const terms: ReactNode[] = [];

  // Costs first, so the price is read before the prize.
  const resources: Array<[string, IconName, number, string, string]> = [
    ['nuts', 'nut', preview.nuts, 'consequence.nutsGain', 'consequence.nutsLoss'],
    ['golden', 'golden', preview.goldenNuts, 'consequence.goldenGain', 'consequence.goldenLoss'],
    ['morale', 'morale', preview.morale, 'event.effects.moraleUp', 'event.effects.moraleDown'],
    ['rep', 'reputation', preview.reputation, 'event.effects.repUp', 'event.effects.repDown'],
  ];
  const resource = ([key, icon, value, gainKey, lossKey]: (typeof resources)[number]) => {
    if (Math.round(value) === 0) return;
    const gain = value > 0;
    const label = t(gain ? gainKey : lossKey, { value: fmt.num(Math.abs(value)) });
    terms.push(
      <Term
        key={key}
        tone={gain ? 'gain' : 'cost'}
        kind={gain ? 'gain' : 'cost'}
        label={label}
        mark={<Icon name={icon} size={12} />}
        long={label}
        short={signed(value)}
      />,
    );
  };
  resources.filter(([, , value]) => value < 0).forEach(resource);
  resources.filter(([, , value]) => value > 0).forEach(resource);
  if (preview.boost) {
    const time = shortTime(preview.boost.seconds, fmt.dur);
    const label = t('event.effects.boost', { value: fmt.num(preview.boost.value), time });
    terms.push(
      <Term
        key="boost"
        tone="gain"
        kind="gain"
        label={label}
        mark={<Icon name="production" size={12} />}
        long={label}
        short={`×${fmt.num(preview.boost.value)}`}
      />,
    );
  }

  for (const person of preview.people) {
    if (!person.emotion && person.friendship === 0) continue;
    const name = nameOf(person.id);
    const mood = person.emotion ? moodWord(t, person.emotion, person.id).toLocaleLowerCase() : null;
    const label = [
      mood ? t('event.effects.mood', { name, mood }) : null,
      person.friendship
        ? t('event.effects.friendship', { name, value: signed(person.friendship) })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const badly = person.friendship < 0 || (person.emotion && !MOOD_POSITIVE[person.emotion]);
    terms.push(
      <Term
        key={`p-${person.id}`}
        tone={badly ? 'cost' : 'people'}
        kind="people"
        label={label}
        mark={person.emotion ? sticker(person.emotion) : null}
        long={
          <>
            <span className="choice-term__name">{name}</span>
            {mood ? <span className="choice-term__word">{mood}</span> : null}
            {person.friendship ? heart(person.friendship) : null}
          </>
        }
        short={
          <>
            <span className="choice-term__name">{name}</span>
            {person.friendship ? heart(person.friendship) : null}
          </>
        }
      />,
    );
  }
  if (preview.everyone) {
    terms.push(
      <Term
        key="everyone"
        tone="people"
        kind="people"
        label={t('event.effects.everyone', { value: signed(preview.everyone) })}
        mark={<Icon name="employees" size={12} />}
        long={heart(preview.everyone)}
      />,
    );
  }

  for (const room of preview.rooms) {
    const name = roomName(room.roomId);
    if (room.mode) {
      const mode = t(`play.${room.roomId}.mode.${room.mode}.name`);
      terms.push(
        <Term
          key={`mode-${room.roomId}`}
          tone="note"
          kind="room"
          label={t('event.effects.mode', { room: name, mode })}
          mark={<Glyph name="dial" size={11} />}
          long={mode}
        />,
      );
    }
    if (room.emotion) {
      terms.push(
        <Term
          key={`mood-${room.roomId}`}
          tone={MOOD_POSITIVE[room.emotion] ? 'people' : 'cost'}
          kind="room"
          label={t('event.effects.roomMood', {
            room: name,
            mood: t(`mood.${room.emotion}`).toLocaleLowerCase(),
          })}
          mark={sticker(room.emotion)}
          long={<span className="choice-term__name">{name}</span>}
          short={<Icon name="rooms" size={11} />}
        />,
      );
    }
    if (room.rush) {
      terms.push(
        <Term
          key={`rush-${room.roomId}`}
          tone="gain"
          kind="room"
          label={t('event.effects.rush', { room: name })}
          mark={<Icon name="production" size={12} />}
          long={t('event.effects.rushShort')}
        />,
      );
    }
  }

  if (preview.souvenir) {
    terms.push(
      <Term
        key="souvenir"
        tone="gain"
        kind="keep"
        label={t('event.effects.souvenir')}
        mark={<Icon name="moment" size={12} />}
        long={t('event.effects.souvenirShort')}
        short=""
      />,
    );
  }
  for (const who of preview.remembers) {
    const label = t('event.effects.remembers', { name: nameOf(who) });
    terms.push(
      <Term
        key={`memory-${who}`}
        tone="note"
        kind="keep"
        label={label}
        mark={<Icon name="employees" size={12} />}
        long={label}
        short={nameOf(who)}
      />,
    );
  }
  // The risk is said in words at every size.
  if (preview.later) {
    terms.push(
      <Term
        key="later"
        tone="note"
        kind="later"
        label={t('event.effects.later')}
        mark={<Icon name="refresh" size={12} />}
        long={t('event.effects.later')}
      />,
    );
  }
  if (preview.continues) {
    terms.push(
      <Term
        key="continues"
        tone="note"
        kind="later"
        label={t('event.effects.continues')}
        mark={<Glyph name="arrow" size={10} />}
        long={t('event.effects.continues')}
      />,
    );
  }

  if (terms.length === 0) return null;
  return (
    <span className="event-choice__effects" id={id}>
      <span className="sr-only">{t('event.effects.label')}</span>
      {terms}
    </span>
  );
}
