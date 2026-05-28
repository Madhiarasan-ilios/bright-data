/**
 * Unit tests for useLocalStorage hook
 *
 * Tests cover:
 * - Returns initialValue when key is absent from localStorage
 * - Reads and parses existing JSON value from localStorage on mount
 * - Falls back to initialValue when stored value is invalid JSON
 * - setValue serialises to JSON and writes to localStorage; updates state
 * - removeValue removes key from localStorage and resets state to initialValue
 * - Works with various generic types (string, number, array, object)
 * - SSR-safe: behaves correctly when window is undefined (simulated)
 *
 * Property test (Property 12: Watched account local storage round-trip):
 * For any account added to the watched list (company name + score), reading
 * the gtm_watched_accounts key from localStorage shall return a list
 * containing that account with its stored score; removing the account shall
 * result in the list no longer containing it.
 *
 * Validates: Requirements 10.1, 10.2
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import { useLocalStorage } from "./useLocalStorage";
import type { WatchedAccount } from "@/lib/types";

// ─── localStorage mock helpers ────────────────────────────────────────────────

function clearLocalStorage() {
  window.localStorage.clear();
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

describe("useLocalStorage", () => {
  beforeEach(() => {
    clearLocalStorage();
  });

  afterEach(() => {
    clearLocalStorage();
  });

  // ── Initialisation ──────────────────────────────────────────────────────────

  it("returns initialValue when key is absent from localStorage", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "default")
    );
    expect(result.current[0]).toBe("default");
  });

  it("reads and parses existing JSON string value from localStorage on mount", () => {
    window.localStorage.setItem("test-key", JSON.stringify("hello"));
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "default")
    );
    expect(result.current[0]).toBe("hello");
  });

  it("reads and parses existing JSON number value from localStorage on mount", () => {
    window.localStorage.setItem("test-key", JSON.stringify(42));
    const { result } = renderHook(() => useLocalStorage("test-key", 0));
    expect(result.current[0]).toBe(42);
  });

  it("reads and parses existing JSON array value from localStorage on mount", () => {
    const arr = [1, 2, 3];
    window.localStorage.setItem("test-key", JSON.stringify(arr));
    const { result } = renderHook(() => useLocalStorage<number[]>("test-key", []));
    expect(result.current[0]).toEqual([1, 2, 3]);
  });

  it("reads and parses existing JSON object value from localStorage on mount", () => {
    const obj = { company_name: "Acme", stored_score: 75 };
    window.localStorage.setItem("test-key", JSON.stringify(obj));
    const { result } = renderHook(() =>
      useLocalStorage<{ company_name: string; stored_score: number }>(
        "test-key",
        { company_name: "", stored_score: 0 }
      )
    );
    expect(result.current[0]).toEqual(obj);
  });

  it("falls back to initialValue when stored value is invalid JSON", () => {
    window.localStorage.setItem("test-key", "not-valid-json{{{");
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "fallback")
    );
    expect(result.current[0]).toBe("fallback");
  });

  // ── setValue ────────────────────────────────────────────────────────────────

  it("setValue updates state", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      result.current[1]("updated");
    });

    expect(result.current[0]).toBe("updated");
  });

  it("setValue writes serialised JSON to localStorage", () => {
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      result.current[1]("written");
    });

    expect(window.localStorage.getItem("test-key")).toBe(
      JSON.stringify("written")
    );
  });

  it("setValue persists objects to localStorage", () => {
    const { result } = renderHook(() =>
      useLocalStorage<{ x: number }>("test-key", { x: 0 })
    );

    act(() => {
      result.current[1]({ x: 99 });
    });

    expect(JSON.parse(window.localStorage.getItem("test-key")!)).toEqual({
      x: 99,
    });
    expect(result.current[0]).toEqual({ x: 99 });
  });

  it("setValue persists arrays to localStorage", () => {
    const { result } = renderHook(() =>
      useLocalStorage<string[]>("test-key", [])
    );

    act(() => {
      result.current[1](["a", "b", "c"]);
    });

    expect(JSON.parse(window.localStorage.getItem("test-key")!)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  // ── removeValue ─────────────────────────────────────────────────────────────

  it("removeValue removes key from localStorage", () => {
    window.localStorage.setItem("test-key", JSON.stringify("stored"));
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    act(() => {
      result.current[2]();
    });

    expect(window.localStorage.getItem("test-key")).toBeNull();
  });

  it("removeValue resets state to initialValue", () => {
    window.localStorage.setItem("test-key", JSON.stringify("stored"));
    const { result } = renderHook(() =>
      useLocalStorage("test-key", "initial")
    );

    // Confirm it read the stored value
    expect(result.current[0]).toBe("stored");

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toBe("initial");
  });

  it("removeValue resets array state to empty array initialValue", () => {
    window.localStorage.setItem("test-key", JSON.stringify(["x", "y"]));
    const { result } = renderHook(() =>
      useLocalStorage<string[]>("test-key", [])
    );

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toEqual([]);
    expect(window.localStorage.getItem("test-key")).toBeNull();
  });

  // ── Multiple keys ───────────────────────────────────────────────────────────

  it("different keys are independent", () => {
    const { result: r1 } = renderHook(() =>
      useLocalStorage("key-a", "a-default")
    );
    const { result: r2 } = renderHook(() =>
      useLocalStorage("key-b", "b-default")
    );

    act(() => {
      r1.current[1]("a-value");
    });

    expect(r1.current[0]).toBe("a-value");
    expect(r2.current[0]).toBe("b-default");
  });
});

// ─── Property-based test ──────────────────────────────────────────────────────
// Feature: gtm-frontend-dashboard, Property 12: Watched account local storage round-trip

/**
 * **Validates: Requirements 10.1, 10.2**
 *
 * For any account added to the watched list (company name + score), reading
 * the gtm_watched_accounts key from localStorage shall return a list
 * containing that account with its stored score; removing the account shall
 * result in the list no longer containing it.
 */
describe("useLocalStorage — Property 12: Watched account local storage round-trip", () => {
  const WATCHED_KEY = "gtm_watched_accounts";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trip: add then read returns account; remove then read omits account", () => {
    fc.assert(
      fc.property(
        // Generate a non-empty company name and a score in [0, 100]
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 0, max: 100 }),
        (companyName, score) => {
          window.localStorage.clear();

          const initialAccounts: WatchedAccount[] = [];

          const { result } = renderHook(() =>
            useLocalStorage<WatchedAccount[]>(WATCHED_KEY, initialAccounts)
          );

          const [, setValue, removeValue] = result.current;

          // Add the account
          const newAccount: WatchedAccount = {
            company_name: companyName,
            stored_score: score,
            watched_at: new Date().toISOString(),
          };

          act(() => {
            setValue([newAccount]);
          });

          // Verify state contains the account
          expect(result.current[0]).toHaveLength(1);
          expect(result.current[0][0].company_name).toBe(companyName);
          expect(result.current[0][0].stored_score).toBe(score);

          // Verify localStorage contains the account
          const raw = window.localStorage.getItem(WATCHED_KEY);
          expect(raw).not.toBeNull();
          const parsed = JSON.parse(raw!) as WatchedAccount[];
          expect(parsed.some((a) => a.company_name === companyName)).toBe(true);

          // Remove the account
          act(() => {
            removeValue();
          });

          // Verify state is reset to initialValue (empty array)
          expect(result.current[0]).toEqual([]);

          // Verify localStorage key is removed
          expect(window.localStorage.getItem(WATCHED_KEY)).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("round-trip: multiple accounts — each added account is retrievable", () => {
    fc.assert(
      fc.property(
        // Generate 1–10 unique company names
        fc
          .array(
            fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
            { minLength: 1, maxLength: 10 }
          )
          .map((names) => [...new Set(names)]) // deduplicate
          .filter((names) => names.length > 0),
        fc.array(fc.integer({ min: 0, max: 100 }), {
          minLength: 1,
          maxLength: 10,
        }),
        (names, scores) => {
          window.localStorage.clear();

          const accounts: WatchedAccount[] = names.map((name, i) => ({
            company_name: name,
            stored_score: scores[i % scores.length],
            watched_at: new Date().toISOString(),
          }));

          const { result } = renderHook(() =>
            useLocalStorage<WatchedAccount[]>(WATCHED_KEY, [])
          );

          act(() => {
            result.current[1](accounts);
          });

          // Every account should be present in state
          for (const account of accounts) {
            expect(
              result.current[0].some(
                (a) => a.company_name === account.company_name
              )
            ).toBe(true);
          }

          // localStorage should contain all accounts
          const raw = window.localStorage.getItem(WATCHED_KEY);
          expect(raw).not.toBeNull();
          const parsed = JSON.parse(raw!) as WatchedAccount[];
          expect(parsed).toHaveLength(accounts.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
