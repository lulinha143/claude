import { useTranslation } from 'react-i18next';
import {
  formatNumber,
  formatInteger,
  formatDuration,
  formatDate,
  formatDateTime,
  formatTime,
} from '../sim/format';

// Locale-aware formatting bound to the active i18n language.
export function useFmt() {
  const { i18n } = useTranslation();
  const locale = i18n.language || 'en';
  return {
    num: (v: number) => formatNumber(v, locale),
    /** a balance the player holds: never rounded up past what can be spent. */
    amount: (v: number) => formatNumber(v, locale, 'floor'),
    int: (v: number) => formatInteger(v, locale),
    dur: (v: number) => formatDuration(v),
    date: (v: number) => formatDate(v, locale),
    dateTime: (v: number) => formatDateTime(v, locale),
    time: (v: number) => formatTime(v, locale),
    /** names in a sentence, the locale's way: "Quincy e Nica", "Quincy and Nixie". */
    list: (items: readonly string[]) =>
      typeof Intl.ListFormat === 'function'
        ? new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items)
        : items.join(', '),
    locale,
  };
}
