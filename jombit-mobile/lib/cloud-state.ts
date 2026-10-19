import type { User } from "@supabase/supabase-js";
import type { AppState, UserProfile } from "./models";
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
  const metadataName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim()
    : "";
  const emailName = user.email?.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  const name = metadataName || emailName || "JomBit Member";

  return createEmptyState({ id: "me", name, defaultCurrency: "MYR", onboarded: false });
}

export function createEmptyState(profile: UserProfile): AppState {
  const state = createSeedState();

  return {
    ...state,
    user: { ...profile },
    members: { me: { id: "me", name: profile.name, hasDuitNowQr: Boolean(profile.duitNowQr) } },
    groups: [],
    expenses: [],
    settlements: [],
    fiatBalances: { MYR: 0, SGD: 0, THB: 0, IDR: 0 },
    counterpartBalances: {},
    crypto: Object.fromEntries(Object.keys(state.crypto).map((asset) => [asset, { asset, available: 0, staked: 0, costBasisCents: 0, firstBoughtAt: null, lastBoughtAt: null }])) as AppState["crypto"],
    walletTransactions: [],
    card: { virtualActive: false, frozen: false, paymentSource: "fiat", paymentAsset: "ETH" },
  };
}

export function createDemoState(): AppState {
  const state = createSeedState();
  return { ...state, user: { ...state.user, onboarded: true } };
}
