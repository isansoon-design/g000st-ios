import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { colorScheme } from 'nativewind';

export type AppThemeMode = 'light' | 'dark';

export const appColors = {
  light: {
    canvas: '#D8D8D8', header: '#D0D0D0', toolbar: '#D0D0D0', card: '#E2E2E2',
    text: '#111111', muted: '#666666', border: '#B8B8B8', incoming: '#29292B',
    outgoing: '#79201D', input: '#FFFFFF', inputText: '#111111', accent: '#C62828',
    tabBar: '#FFFFFF', tabInactive: '#737373',
  },
  dark: {
    canvas: '#929197', header: '#85848B', toolbar: '#5C5B61', card: '#77767C',
    text: '#FFFFFF', muted: '#E0DEE2', border: '#38373C', incoming: '#C1282D',
    outgoing: '#111111', input: '#F2F2F2', inputText: '#222222', accent: '#C1282D',
    tabBar: '#5C5B61', tabInactive: '#C4C3C6',
  },
} as const;

const STORAGE_KEY = 'g000st:app-theme:v1';
const LEGACY_STORAGE_KEY = 'g000st:chat-theme:v1';

type AppThemeContextValue = Readonly<{
  mode: AppThemeMode;
  setMode: (mode: AppThemeMode) => void;
}>;

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const [mode, updateMode] = useState<AppThemeMode>('light');
  const [ready, setReady] = useState(false);
  const changedByUser = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      let stored: string | null = null;
      let migrated = false;
      try {
        stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) {
          stored = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
          migrated = stored === 'light' || stored === 'dark';
        }
      } catch {
        // The light mode remains usable when local storage is unavailable.
      }
      if (!active) return;
      const next = stored === 'dark' ? 'dark' : 'light';
      if (!changedByUser.current) {
        updateMode(next);
        colorScheme.set(next);
        if (migrated) {
          void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
        }
      }
      setReady(true);
    })();
    return () => { active = false; };
  }, []);

  const value = useMemo<AppThemeContextValue>(() => ({
    mode,
    setMode(next) {
      changedByUser.current = true;
      updateMode(next);
      colorScheme.set(next);
      void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
    },
  }), [mode]);

  return <AppThemeContext.Provider value={value}>{ready ? children : null}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme must be used within AppThemeProvider');
  return { ...context, colors: appColors[context.mode], isDark: context.mode === 'dark' };
}
