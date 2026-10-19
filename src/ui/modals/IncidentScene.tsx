import { useTranslation } from 'react-i18next';
import type { EmployeeMood, EventRarity } from '../../sim/types';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { ROOMS_BY_ID } from '../../content/rooms';
import { RoomDressing } from '../../art/RoomDressing';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { employeeSprite } from '../../art/employeeSprites';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { DEPT } from '../../art/roomStyle';
import { Glyph } from '../../art/Glyph';
import { STICKER_FOR_MOOD, StickerArt } from '../../art/EmotionSticker';

// The top of an event card: the room it is happening in, the teammate who
// brought it to you and whoever else it is about, and how unusual it is. The
// choice and its outcome share it, so the outcome reads as the same card turned
// over rather than a second popup.
//
// The people in it react on the card itself: while an answer is pointed at (or
// focused), whoever it would change shows how they would take it, a mood sticker
// by their head and a heart going up or down; turned over, the same marks say
// how they did take it.

/** How a teammate takes an answer (asked) or took it (the outcome). */
export interface ActorReaction {
  emotion?: EmployeeMood | null;
  friendship?: number;
}

function Actor({
  id,
  lead,
  told,
  reducedMotion,
  reaction,
}: {
  id: string;
  lead: boolean;
  told: boolean;
  reducedMotion: boolean;
  reaction?: ActorReaction;
}) {
  const def = EMPLOYEES_BY_ID[id];
  const sprite = employeeSprite(id);
  if (!def) return null;
  const height = lead ? 92 : 76;
  const shape = shapeFor(id);
  // Where their head starts, from the bottom of their art (the registry's own).
  const head = sprite ? 1 - sprite.figureTop : 0.9;
  const shows = Boolean(reaction && (reaction.emotion || reaction.friendship));
  return (
    <span
      className={`incident-scene__actor ${lead ? 'is-lead' : ''}`}
      data-employee={id}
      data-told={told ? 'true' : undefined}
      data-reacting={shows ? 'true' : undefined}
      style={{ ['--head' as string]: head.toFixed(3) }}
    >
      {sprite ? (
        <EmployeeSprite config={sprite} reducedMotion={reducedMotion} height={height} />
      ) : (
        <Critter
          species={shape.species}
          color={def.color}
          accent={def.accent}
          state="talk"
          hasGlasses={shape.hasGlasses}
          size={Math.round(height * 0.72)}
        />
      )}
      {shows && reaction ? (
        <span className="incident-scene__reaction" aria-hidden>
          {reaction.emotion ? (
            <span
              className="incident-scene__sticker"
              data-sticker={STICKER_FOR_MOOD[reaction.emotion]}
            >
              <StickerArt kind={STICKER_FOR_MOOD[reaction.emotion]} />
            </span>
          ) : null}
          {reaction.friendship ? (
            <span
              className="incident-scene__heart"
              data-tone={reaction.friendship > 0 ? 'up' : 'down'}
            >
              <Glyph name="heart" size={9} />
              {reaction.friendship > 0 ? '+' : '-'}
              {Math.abs(reaction.friendship)}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

export function IncidentScene({
  roomId,
  people,
  rarity,
  told = false,
  reducedMotion,
  reactions,
}: {
  roomId: string;
  /** who is in it: the presenter first, then whoever else it is about. */
  people: readonly string[];
  rarity: EventRarity;
  /** the outcome side of the card: the people react. */
  told?: boolean;
  reducedMotion: boolean;
  /** how the people in it take (or took) an answer, by teammate. */
  reactions?: Readonly<Record<string, ActorReaction>>;
}) {
  const { t } = useTranslation();
  const room = ROOMS_BY_ID[roomId];
  const cast = [...new Set(people)].filter((id) => EMPLOYEES_BY_ID[id]).slice(0, 3);
  return (
    <div
      className="incident-scene"
      data-rarity={rarity}
      data-room={roomId}
      data-told={told ? 'true' : undefined}
      style={{ ['--dept' as string]: DEPT[roomId] ?? 'var(--dept-founder)' }}
    >
      <RoomDressing roomId={roomId} />
      <span className="incident-scene__cast" aria-hidden>
        {cast.map((id, index) => (
          <Actor
            key={id}
            id={id}
            lead={index === 0}
            told={told}
            reducedMotion={reducedMotion}
            reaction={reactions?.[id]}
          />
        ))}
      </span>
      {room ? <span className="incident-scene__room">{t(room.nameKey)}</span> : null}
      <span className="incident-scene__stamp">{t(`incident.stamp.${rarity}`)}</span>
    </div>
  );
}
