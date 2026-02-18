import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { translations, type Language } from '@/i18n';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function detectLanguage(): Language {
  const saved = localStorage.getItem('app-language');
  if (saved && (saved === 'pt' || saved === 'en' || saved === 'es')) {
    return saved as Language;
  }
  const nav = navigator.language.toLowerCase();
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('en')) return 'en';
  return 'pt';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(detectLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  }, []);

  const t = useCallback((key: string): string => {
    return translations[language][key] || translations['pt'][key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
