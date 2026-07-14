import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import ptBR from './locales/pt-BR.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import pl from './locales/pl.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';

export const SUPPORTED_LANGUAGES = [
  'en',
  'pt-BR',
  'es',
  'fr',
  'de',
  'it',
  'pl',
  'ru',
  'ja',
  'ko',
  'zh-CN',
  'zh-TW',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  en: { translation: en },
  'pt-BR': { translation: ptBR },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  pl: { translation: pl },
  ru: { translation: ru },
  ja: { translation: ja },
  ko: { translation: ko },
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
} as const;

export function languageDisplayName(lang: string): string {
  const meta = (resources as Record<string, { translation: { _meta?: { name?: string } } }>)[lang]
    ?.translation?._meta;
  return meta?.name ?? lang;
}

export async function initI18n(initialLanguage?: string): Promise<typeof i18n> {
  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: 'en',
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      // pt-BR should not be truncated to 'pt' — keep region tags.
      load: 'currentOnly',
      nonExplicitSupportedLngs: false,
      returnObjects: true,
      interpolation: { escapeValue: false },
      detection: {
        order: ['localStorage', 'navigator'],
        lookupLocalStorage: 'wmno.lang',
        caches: [],
      },
    });
  return i18n;
}

export default i18n;
