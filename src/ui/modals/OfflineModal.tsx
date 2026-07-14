import { useTranslation } from 'react-i18next';
import { useStore } from '../../state/store';
import { useFmt } from '../useFmt';
import { Crate } from '../../art/Icons';

export function OfflineModal() {
  const { t } = useTranslation();
  const fmt = useFmt();
  const result = useStore((s) => s.offlineResult);
  const dismiss = useStore((s) => s.dismissOffline);
  if (!result) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal offline-modal" role="dialog" aria-modal>
        <Crate size={72} />
        <h2>{t('offline.title')}</h2>
        <p>{t('offline.welcomeBack')}</p>
        <p>{t('offline.duration', { duration: fmt.dur(result.cappedSeconds) })}</p>
        <p className="big-number">{t('offline.earned', { value: fmt.num(result.nutsEarned) })}</p>
        <p className="muted small">{t('offline.rate', { value: fmt.num(result.ratePerSecond) })}</p>
        {result.wasCapped ? <p className="muted small">{t('offline.capped')}</p> : null}
        <button className="buy-btn buy-btn--big" onClick={dismiss}>
          {t('common.ok')}
        </button>
      </div>
    </div>
  );
}
