import { useTranslation } from 'react-i18next';
import type { GameState } from '../../sim/types';
import { DECORATIONS_BY_ID } from '../../content/decorations';
import { decorationRoom } from '../../sim/decorations';
import { unlockedRooms } from '../../sim/rooms';
import { Icon } from '../../art/UiIcon';
import { PopupShell } from './PopupShell';

interface MoveDecorationModalProps {
  state: GameState;
  decorationId: string;
  onMove: (roomId: string | null) => boolean;
  onDismiss: () => void;
}

/** Keyboard/touch alternative to precision dragging between office rooms. */
export function MoveDecorationModal({
  state,
  decorationId,
  onMove,
  onDismiss,
}: MoveDecorationModalProps) {
  const { t } = useTranslation();
  const def = DECORATIONS_BY_ID[decorationId];
  if (!def) return null;

  const currentRoom = decorationRoom(state, decorationId);
  const rooms = unlockedRooms(state).filter((room) => def.compatibleRooms.includes(room.id));
  const titleId = `move-decoration-${decorationId}-title`;
  const move = (roomId: string | null) => {
    if (roomId === currentRoom) return;
    if (onMove(roomId)) onDismiss();
  };

  return (
    <PopupShell
      variant="decoration"
      className="move-decoration-popup"
      titleId={titleId}
      onDismiss={onDismiss}
      closeOnBackdrop
      actions={
        <button className="mini-btn" onClick={onDismiss}>
          {t('common.cancel')}
        </button>
      }
    >
      <header className="popup__header">
        <span className="popup__eyebrow">{t('decorate.moveTo')}</span>
        <h2 id={titleId}>{t('decorate.moveToTitle', { item: t(def.nameKey) })}</h2>
        <p>{t('decorate.moveToHelp')}</p>
      </header>
      <div className="move-decoration__rooms" role="group" aria-label={t('decorate.chooseRoom')}>
        {rooms.map((room) => {
          const current = currentRoom === room.id;
          return (
            <button
              key={room.id}
              className={`move-decoration__room ${current ? 'is-current' : ''}`}
              onClick={() => move(room.id)}
              disabled={current}
              aria-label={t('decorate.moveToRoom', { room: t(room.nameKey) })}
            >
              <Icon name={current ? 'success' : 'rooms'} size={16} />
              <span>{t(room.nameKey)}</span>
              {current ? <small>{t('decorate.currentRoom')}</small> : null}
            </button>
          );
        })}
        <button
          className={`move-decoration__room move-decoration__room--storage ${currentRoom === null ? 'is-current' : ''}`}
          onClick={() => move(null)}
          disabled={currentRoom === null}
          aria-label={t('decorate.moveToRoom', { room: t('decorate.inventory') })}
        >
          <Icon name="hidden" size={16} />
          <span>{t('decorate.inventory')}</span>
          {currentRoom === null ? <small>{t('decorate.currentRoom')}</small> : null}
        </button>
      </div>
    </PopupShell>
  );
}
