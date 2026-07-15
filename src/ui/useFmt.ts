import { useTranslation } from 'react-i18next';
import { formatNumber, formatInteger, formatDuration, formatDate } from '../sim/format';

// Locale-aware formatting bound to the active i18n language.
export function useFmt() {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';
  return {
    num: (v: number) => formatNumber(v, locale),
    int: (v: number) => formatInteger(v, locale),
    dur: (v: number) => formatDuration(v),
    date: (v: number) => formatDate(v, locale),
    locale,
  };
}
