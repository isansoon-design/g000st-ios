import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { sessionStorage } from "@/app/api/session-storage";
import type { PersistedSession } from "@/features/auth/types";

/**
 * Custom hook to manage localStorage with SSR safety
 */
export function useLocalStorage<T = any>(key: string, initialValue?: T) {
  const [storedValue, setStoredValue] = useState<T | undefined>(initialValue);

  // Only run on client side
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      } else {
        setStoredValue(initialValue);
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      setStoredValue(initialValue);
    }
  }, [key, initialValue]);

  const setValue = useCallback(
    (value: T | ((val: T | undefined) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;

        // Update state
        setStoredValue(valueToStore);

        // Update localStorage
        if (typeof window !== "undefined") {
          if (valueToStore === undefined) {
            window.localStorage.removeItem(key);
          } else {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          }
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}

/**
 * Custom hook for authentication state
 */
export function useAuth() {
  const router = useRouter();
  const [session, setSession] = useState<PersistedSession | null>(null);

  useEffect(() => {
    setSession(sessionStorage.get());
  }, []);

  const logout = useCallback(() => {
    sessionStorage.clear();
    setSession(null);
    router.push("/login");
  }, [router]);

  return {
    token: session?.tokens.accessToken,
    userId: session?.user.publicId,
    isAuthenticated: !!session,
    logout,
  };
}

/**
 * Custom hook for managing async operations
 */
export function useAsync<T, E = string>(
  asyncFunction: () => Promise<T>,
  immediate = true
) {
  const [state, setState] = useState<{
    loading: boolean;
    data: T | null;
    error: E | null;
  }>({
    loading: immediate,
    data: null,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ loading: true, data: null, error: null });
    try {
      const response = await asyncFunction();
      setState({ loading: false, data: response, error: null });
      return response;
    } catch (error) {
      setState({
        loading: false,
        data: null,
        error: error as E,
      });
      throw error;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { ...state, execute };
}

/**
 * Custom hook for debounced values
 */
export function useDebounce<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
