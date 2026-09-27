import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGES, translate } from '../lib/i18n.js';

const PrefsContext = createContext(null);
const THEME_KEY = 'shoplab.theme';
const LANG_KEY = 'shoplab.lang';

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function initialTheme() {
  const saved = readStorage(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function PrefsProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);
  const [lang, setLangState] = useState(() => (readStorage(LANG_KEY) === 'ar' ? 'ar' : 'en'));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const def = LANGUAGES.find((l) => l.code === lang);
    document.documentElement.lang = def.code;
    document.documentElement.dir = def.dir;
  }, [lang]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  }, []);

  const setLang = useCallback((next) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {}
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'), lang, setLang, dir: lang === 'ar' ? 'rtl' : 'ltr', t }),
    [theme, setTheme, lang, setLang, t],
  );
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
