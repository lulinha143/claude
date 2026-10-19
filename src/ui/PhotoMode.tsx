import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGame } from '../state/hooks';
import { useStore } from '../state/store';
import { useFmt } from './useFmt';
import { OfficeScene } from '../art/OfficeScene';
import { Icon } from '../art/UiIcon';
import { unlockedRooms } from '../sim/rooms';
import { EMPLOYEES_BY_ID } from '../content/employees';
import { officePhotoToPng } from './officePhoto';
import { GAME_TITLE } from '../brand';

// A clean, framed "photo mode": the office with all chrome hidden, a caption
// bar, and a one-click branded PNG export. Robust in browser + Electron.
export function PhotoMode() {
  const { t } = useTranslation();
  const { state } = useGame();
  const fmt = useFmt();
  const setPhotoMode = useStore((s) => s.setPhotoMode);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  function save() {
    const hired = Object.entries(state.employees).filter(([, e]) => e.hired);
    const critterColors = hired.map(([id]) => EMPLOYEES_BY_ID[id]?.color ?? '#c65b3c');
    const png = officePhotoToPng({
      companyName: state.company.name,
      tagline: t('photo.tagline'),
      dateLabel: fmt.date(Date.now()),
      brand: GAME_TITLE,
      critterColors,
      stats: [
        { label: t('resource.nuts'), value: fmt.num(state.resources.nuts) },
        { label: t('nav.employees'), value: String(hired.length) },
        { label: t('nav.office'), value: String(unlockedRooms(state).length) },
        { label: t('resource.morale'), value: `${Math.round(state.resources.morale)}%` },
      ],
    });
    if (!png) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
      return;
    }
    try {
      const a = document.createElement('a');
      a.href = png;
      a.download = `office-${Date.now()}.png`;
      a.click();
      setStatus('saved');
    } catch {
      setStatus('error');
    }
    setTimeout(() => setStatus('idle'), 2500);
  }

  return (
    <div className="photo-mode">
      <div className="photo-mode__frame">
        <div className="photo-mode__stage">
          <OfficeScene />
        </div>
        <div className="photo-mode__caption">
          <span className="photo-mode__company">{state.company.name}</span>
          <span className="photo-mode__tagline">{t('photo.tagline')}</span>
        </div>
      </div>
      <div className="photo-mode__toolbar">
        <button className="buy-btn" onClick={save}>
          <Icon name="photo" size={15} />{' '}
          {status === 'saved'
            ? t('photo.saved')
            : status === 'error'
              ? t('photo.error')
              : t('photo.save')}
        </button>
        <button className="ghost-btn" onClick={() => setPhotoMode(false)}>
          <Icon name="close" size={15} /> {t('common.close')}
        </button>
      </div>
    </div>
  );
}
