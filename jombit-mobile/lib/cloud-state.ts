import type { User } from "@supabase/supabase-js";
import type { AppState } from "./models";
import { normalizeCryptoHistory } from "./crypto-ledger.ts";
import { createSeedState } from "./seed.ts";

export const CLOUD_STATE_SCHEMA_VERSION = 1;

export interface CloudStateRow {
  state: unknown;
  schema_version: number;
  device_id: string;
  updated_at: string;
}

export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<AppState>;
  return Boolean(
    state.user
    && typeof state.user.name === "string"
    && state.members
    && Array.isArray(state.groups)
    && Array.isArray(state.expenses)
    && Array.isArray(state.settlements)
    && state.fiatBalances
    && state.crypto
    && Array.isArray(state.walletTransactions)
    && state.card,
  );
}

export function normalizeCloudState(value: unknown): AppState | undefined {
  if (!isAppState(value)) return undefined;
  return normalizeCryptoHistory(value);
}

export function createCloudState(user: Pick<User, "email" | "user_metadata">): AppState {
  const state = createSeedState();
  const metadataName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim()
    : "";
  const emailName = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  const name = metadataName || emailName || "JomBit Member";

  return {
    ...state,
    user: { ...state.user, name, onboarded: false },
    members: { ...state.members, me: { ...state.members.me, name } },
  };
}

