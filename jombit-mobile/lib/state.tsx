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
import { executeCryptoCommand, executeCryptoReceive, executeCryptoTransfer, normalizeCryptoHistory, type CryptoCommand, type CryptoReceiveCommand, type CryptoTransferCommand } from "./crypto-ledger";
import { executeFiatCommand, type FiatCommand } from "./fiat-ledger";
import { LOGO_LARGE } from "./brand";
import type { User } from "@supabase/supabase-js";
import { CLOUD_STATE_SCHEMA_VERSION, createCloudState, createDemoState, createEmptyState, normalizeCloudState, type CloudStateRow } from "./cloud-state";
import { getSupabase } from "./supabase";

const STORAGE_KEY = "jombit-mobile-demo-state-v1";

interface AppStateValue {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  reset: () => void;
  stakeCrypto: (command: CryptoCommand) => void;
  receiveCrypto: (command: CryptoReceiveCommand) => void;
  transferCrypto: (command: CryptoTransferCommand) => void;
  transactFiat: (command: FiatCommand) => void;
  backendMode: "local" | "cloud" | "demo";
  syncStatus: "local" | "loading" | "saved" | "saving" | "error";
  userEmail?: string;
  signOut: () => Promise<void>;
}

const StateContext = createContext<AppStateValue | null>(null);

function getDeviceId() {
  try {
    const existing = sessionStorage.getItem("jombit-cloud-device-id");
    if (existing) return existing;
    const next = globalThis.crypto?.randomUUID?.() ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("jombit-cloud-device-id", next);
    return next;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function AppStateProvider({ children, cloudUser, demoMode = false, onExitDemo }: { children: ReactNode; cloudUser?: User; demoMode?: boolean; onExitDemo?: () => void }) {
  const [state, setReactState] = useState<AppState>(() => demoMode ? createDemoState() : createSeedState());
  const currentState = useRef(state);
  const dirty = useRef(false);
  const deviceId = useRef(getDeviceId());
  const [syncStatus, setSyncStatus] = useState<AppStateValue["syncStatus"]>(cloudUser ? "loading" : "local");
  const replaceState = useCallback((next: AppState, markDirty: boolean) => {
    currentState.current = next;
    dirty.current = markDirty;
    setReactState(next);
  }, []);
  // Keep commands atomic, including rapid confirmations and delayed wallet actions.
  const setState: React.Dispatch<React.SetStateAction<AppState>> = useCallback((update) => {
    const next = typeof update === "function" ? update(currentState.current) : update;
    replaceState(next, true);
  }, [replaceState]);
  const stakeCrypto = useCallback((command: CryptoCommand) => {
    setState(executeCryptoCommand(currentState.current, command));
  }, [setState]);
  const receiveCrypto = useCallback((command: CryptoReceiveCommand) => {
    setState(executeCryptoReceive(currentState.current, command));
  }, [setState]);
  const transferCrypto = useCallback((command: CryptoTransferCommand) => {
    setState(executeCryptoTransfer(currentState.current, command));
  }, [setState]);
  const transactFiat = useCallback((command: FiatCommand) => {
    setState(executeFiatCommand(currentState.current, command));
  }, [setState]);
  const [hydrated, setHydrated] = useState(false);
  const [storageUnavailable, setStorageUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    setHydrated(false);
    setStorageUnavailable(false);

    if (demoMode) {
      replaceState(createDemoState(), false);
      setSyncStatus("local");
      setHydrated(true);
      return;
    }

    if (cloudUser) {
      const supabase = getSupabase();
      if (!supabase) return;
      setSyncStatus("loading");
      void supabase
        .from("jombit_states")
        .select("state,schema_version,device_id,updated_at")
        .eq("user_id", cloudUser.id)
        .maybeSingle<CloudStateRow>()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) {
            setSyncStatus("error");
            setHydrated(true);
            return;
          }
          const stored = data ? normalizeCloudState(data.state) : undefined;
          replaceState(stored ?? createCloudState(cloudUser), !stored);
          setSyncStatus(stored ? "saved" : "saving");
          setHydrated(true);
        });
      return () => { active = false; };
    }

    setSyncStatus("local");
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) replaceState(normalizeCryptoHistory(JSON.parse(stored) as AppState), false);
      } catch {
        // Some browsers restrict storage for a directly opened HTML file.
        setStorageUnavailable(true);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cloudUser, demoMode, replaceState]);

  useEffect(() => {
    if (!hydrated || cloudUser || demoMode) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      const timer = window.setTimeout(() => setStorageUnavailable(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, [cloudUser, demoMode, hydrated, state]);

  useEffect(() => {
    if (!cloudUser || !hydrated || !dirty.current) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const snapshot = state;
    setSyncStatus("saving");
    const timer = window.setTimeout(() => {
      void supabase.from("jombit_states").upsert({
        user_id: cloudUser.id,
        state: snapshot,
        schema_version: CLOUD_STATE_SCHEMA_VERSION,
        device_id: deviceId.current,
      }, { onConflict: "user_id" }).then(({ error }) => {
        if (error) return setSyncStatus("error");
        if (currentState.current === snapshot) dirty.current = false;
        setSyncStatus("saved");
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [cloudUser, hydrated, state]);

  useEffect(() => {
    if (!cloudUser || !hydrated) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase.channel(`jombit-state-${cloudUser.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "jombit_states",
        filter: `user_id=eq.${cloudUser.id}`,
      }, (payload) => {
        const row = payload.new as CloudStateRow;
        if (row.device_id === deviceId.current) return;
        const next = normalizeCloudState(row.state);
        if (next) {
          replaceState(next, false);
          setSyncStatus("saved");
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [cloudUser, hydrated, replaceState]);

  const value = useMemo<AppStateValue>(
    () => ({
      state,
      setState,
      stakeCrypto,
      receiveCrypto,
      transferCrypto,
      transactFiat,
      reset: () => setState(demoMode ? createDemoState() : createEmptyState({ ...state.user, onboarded: true })),
      backendMode: demoMode ? "demo" : cloudUser ? "cloud" : "local",
      syncStatus,
      userEmail: cloudUser?.email,
      signOut: async () => { if (demoMode) onExitDemo?.(); else await getSupabase()?.auth.signOut(); },
    }),
    [cloudUser, demoMode, onExitDemo, state, setState, stakeCrypto, receiveCrypto, transferCrypto, syncStatus, transactFiat],
  );

  return (
    <StateContext.Provider value={value}>
      {storageUnavailable && <div className="storage-notice" role="status">Your browser has disabled saving. This session works, but changes may be lost when you close it.</div>}
      {cloudUser && syncStatus === "error" && <div className="storage-notice" role="alert">JomBit could not reach your private cloud data. Check your connection and Supabase setup before making more changes.</div>}
      {hydrated ? children : <div className="app-loading"><img src={LOGO_LARGE.src} width={LOGO_LARGE.width} height={LOGO_LARGE.height} alt="JomBit" /><span>Preparing JomBit…</span></div>}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) throw new Error("useAppState must be used inside AppStateProvider");
  return context;
}

