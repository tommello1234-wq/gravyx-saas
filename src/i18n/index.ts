import { pt } from './pt';
import { en } from './en';
import { es } from './es';

export type Language = 'pt' | 'en' | 'es';

export type TranslationKeys = keyof typeof pt;

export const translations: Record<Language, Record<string, string>> = {
  pt,
  en,
  es,
};

export const languageLabels: Record<Language, { flag: string; label: string }> = {
  pt: { flag: '🇧🇷', label: 'Português' },
  en: { flag: '🇺🇸', label: 'English' },
  es: { flag: '🇪🇸', label: 'Español' },
};
