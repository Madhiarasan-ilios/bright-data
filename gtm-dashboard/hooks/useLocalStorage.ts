import { useState, useCallback } from "react";

/**
 * Generic hook wrapping localStorage get/set/remove with JSON serialisation.
 *
 * SSR-safe: all localStorage access is guarded with `typeof window !== 'undefined'`.
 *
 * @param key - The localStorage key to read/write
 * @param initialValue - Fallback value when the key is absent or JSON parse fails
 * @returns [storedValue, setValue, removeValue]
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void, () => void] {
  // Initialise state by reading from localStorage (SSR-safe)
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw) as T;
    } catch {
      // JSON parse failure or localStorage unavailable — fall back to initial
      return initialValue;
    }
  });

  /**
   * Serialise `value` to JSON and write it to localStorage, then update state.
   */
  const setValue = useCallback(
    (value: T) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(key, JSON.stringify(value));
        } catch {
          // localStorage may be unavailable (e.g. private browsing quota exceeded)
        }
      }
      setStoredValue(value);
    },
    [key]
  );

  /**
   * Remove the key from localStorage and reset state to `initialValue`.
   */
  const removeValue = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // localStorage may be unavailable
      }
    }
    setStoredValue(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [storedValue, setValue, removeValue];
}
