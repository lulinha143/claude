import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { Crate } from '../../art/Icons';
import { PopupShell, usePopupExit } from './PopupShell';

export function OfflineModal() {
  const { t } = useTranslation();
  const fmt = useFmt();
  const result = useStore((s) => s.offlineResult);
  const dismiss = useStore((s) => s.dismissOffline);
  const { closing, exitThen } = usePopupExit();
  if (!result) return null;
  const titleId = 'offline-popup-title';
  const close = () => exitThen(dismiss);

  return (
    <PopupShell
      variant="reward"
      className="offline-modal"
      titleId={titleId}
      closing={closing}
      onDismiss={close}
      actions={
        <button className="buy-btn buy-btn--big" disabled={closing} onClick={close}>
          {t('common.ok')}
        </button>
      }
    >
      <div className="popup__hero-art">
        <Crate size={72} />
      </div>
      <h2 id={titleId}>{t('offline.title')}</h2>
      <p>{t('offline.welcomeBack')}</p>
      <p>{t('offline.duration', { duration: fmt.dur(result.cappedSeconds) })}</p>
      <p className="big-number">{t('offline.earned', { value: fmt.num(result.nutsEarned) })}</p>
      <p className="muted small">{t('offline.rate', { value: fmt.num(result.ratePerSecond) })}</p>
      {result.wasCapped ? <p className="muted small">{t('offline.capped')}</p> : null}
    </PopupShell>
  );
}
