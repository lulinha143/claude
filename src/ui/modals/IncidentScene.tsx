import { useTranslation } from 'react-i18next';
import type { EventRarity } from '../../sim/types';
import { EMPLOYEES_BY_ID } from '../../content/employees';
import { ROOMS_BY_ID } from '../../content/rooms';
import { RoomDressing } from '../../art/RoomDressing';
import { EmployeeSprite } from '../../art/EmployeeSprite';
import { employeeSprite } from '../../art/employeeSprites';
import { Critter } from '../../art/Critter';
import { shapeFor } from '../../art/critterShapes';
import { DEPT } from '../../art/roomStyle';

// The top of an event card: the room it is happening in, the teammate who
// brought it to you and whoever else it is about, and how unusual it is. The
// choice and its outcome share it, so the outcome reads as the same card turned
// over rather than a second popup.

function Actor({
  id,
  lead,
  told,
  reducedMotion,
}: {
  id: string;
  lead: boolean;
  told: boolean;
  reducedMotion: boolean;
}) {
  const def = EMPLOYEES_BY_ID[id];
  const sprite = employeeSprite(id);
  if (!def) return null;
  const height = lead ? 92 : 76;
  const shape = shapeFor(id);
  return (
    <span
      className={`incident-scene__actor ${lead ? 'is-lead' : ''}`}
      data-employee={id}
      data-told={told ? 'true' : undefined}
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
    </span>
  );
}

export function IncidentScene({
  roomId,
  people,
  rarity,
  told = false,
  reducedMotion,
}: {
  roomId: string;
  /** who is in it: the presenter first, then whoever else it is about. */
  people: readonly string[];
  rarity: EventRarity;
  /** the outcome side of the card: the people react. */
  told?: boolean;
  reducedMotion: boolean;
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
          <Actor key={id} id={id} lead={index === 0} told={told} reducedMotion={reducedMotion} />
        ))}
      </span>
      {room ? <span className="incident-scene__room">{t(room.nameKey)}</span> : null}
      <span className="incident-scene__stamp">{t(`incident.stamp.${rarity}`)}</span>
    </div>
  );
}
