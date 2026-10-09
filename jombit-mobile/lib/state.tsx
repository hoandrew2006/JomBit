"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createSeedState } from "./seed";
import type { AppState } from "./models";
import { executeCryptoCommand, normalizeCryptoHistory, type CryptoCommand } from "./crypto-ledger";
import { executeFiatCommand, type FiatCommand } from "./fiat-ledger";

const STORAGE_KEY = "jombit-mobile-demo-state-v1";

interface AppStateValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  reset: () => void;
  stakeCrypto: (command: CryptoCommand) => void;
  transactFiat: (command: FiatCommand) => void;
}

const StateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setReactState] = useState<AppState>(() => createSeedState());
  const currentState = useRef(state);
  // Keep commands atomic, including rapid confirmations and delayed wallet actions.
  const setState: React.Dispatch<React.SetStateAction<AppState>> = useCallback((update) => {
    const next = typeof update === "function" ? update(currentState.current) : update;
    currentState.current = next;
    setReactState(next);
  }, []);
  const stakeCrypto = useCallback((command: CryptoCommand) => {
    setState(executeCryptoCommand(currentState.current, command));
  }, [setState]);
  const transactFiat = useCallback((command: FiatCommand) => {
    setState(executeFiatCommand(currentState.current, command));
  }, [setState]);
  const [hydrated, setHydrated] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setState(normalizeCryptoHistory(JSON.parse(stored) as AppState));
      } catch {
        // Some browsers restrict storage for a directly opened HTML file.
        setStorageUnavailable(true);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      const timer = window.setTimeout(() => setStorageUnavailable(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, [hydrated, state]);

  const value = useMemo(
    () => ({
      state,
      setState,
      stakeCrypto,
      transactFiat,
      reset: () => setState(createSeedState()),
    }),
    [state, setState, stakeCrypto, transactFiat],
  );

  return (
    <StateContext.Provider value={value}>
      {storageUnavailable && <div className="storage-notice" role="status">Your browser has disabled saving. This session works, but changes may be lost when you close it.</div>}
      {hydrated ? children : <div className="app-loading">Preparing JomBit…</div>}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) throw new Error("useAppState must be used inside AppStateProvider");
  return context;
}

