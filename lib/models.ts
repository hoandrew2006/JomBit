export type Currency = "MYR" | "SGD" | "THB" | "IDR";
export type CryptoAsset = "BTC" | "ETH" | "SOL";

export interface UserProfile {
  id: "me";
  name: string;
  defaultCurrency: Currency;
  duitNowQr?: string;
  onboarded: boolean;
}

export interface GroupMember {
  id: string;
  name: string;
  hasDuitNowQr?: boolean;
}

export interface ItemAllocation {
  memberIds: string[];
}

export interface ExpenseItem {
  id: string;
  name: string;
  quantity: number;
  unitCents: number;
  allocation: ItemAllocation;
}

export interface MemberShare {
  itemsCents: number;
  taxCents: number;
  serviceCents: number;
  totalCents: number;
}

export interface Expense {
  id: string;
  groupId: string;
  merchant: string;
  date: string;
  payerId: string;
  currency: Currency;
  items: ExpenseItem[];
  taxCents: number;
  serviceCents: number;
  shares: Record<string, MemberShare>;
  receiptPreview?: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromId: string;
  toId: string;
  amountCents: number;
  currency: Currency;
  date: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  currency: Currency;
  memberIds: string[];
}

export type WalletTransactionKind =
  | "topup"
  | "exchange"
  | "transfer"
  | "crypto-buy"
  | "crypto-sell"
  | "stake"
  | "unstake"
  | "card"
  | "settlement";

export interface WalletTransaction {
  id: string;
  kind: WalletTransactionKind;
  title: string;
  subtitle: string;
  amountCents?: number;
  currency?: Currency;
  date: string;
  direction: "in" | "out" | "neutral";
}

export interface CryptoHolding {
  asset: CryptoAsset;
  available: number;
  staked: number;
}

export interface JomBitCard {
  virtualActive: boolean;
  physicalType?: "plastic" | "metal";
  frozen: boolean;
  paymentSource: "fiat" | "crypto";
}

export interface AppState {
  user: UserProfile;
  members: Record<string, GroupMember>;
  groups: Group[];
  expenses: Expense[];
  settlements: Settlement[];
  fiatBalances: Record<Currency, number>;
  counterpartBalances: Record<string, Partial<Record<Currency, number>>>;
  crypto: Record<CryptoAsset, CryptoHolding>;
  walletTransactions: WalletTransaction[];
  card: JomBitCard;
}

export interface SettlementSuggestion {
  fromId: string;
  toId: string;
  amountCents: number;
}

