export type Currency = "MYR" | "SGD" | "THB" | "IDR";
export type CryptoAsset = "BTC" | "ETH" | "SOL" | "ADA" | "ATOM" | "AVAX" | "DOT" | "NEAR";

// Spending categories used by Insights. Optional on records so older saved state still loads.
export type SpendCategory = "food" | "groceries" | "transport" | "shopping" | "entertainment" | "travel" | "bills" | "others";

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
  category?: SpendCategory;
  // MYR value of one unit of `currency` on the expense day; older records fall back to demo rates.
  myrRate?: number;
}

export interface Settlement {
  id: string;
  groupId: string;
  fromId: string;
  toId: string;
  amountCents: number;
  currency: Currency;
  date: string;
  paymentMethod?: "fiat" | "crypto";
  cryptoAsset?: CryptoAsset;
  cryptoQuantity?: number;
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
  | "crypto-receive"
  | "crypto-transfer"
  | "stake"
  | "unstake"
  | "card"
  | "settlement"
  | "payment"
  | "received"
  | "staking-reward"
  // Paid a merchant with crypto: amountCents is the MYR the recipient received; crypto holds the coin and fee.
  | "crypto-payment"
  | "withdrawal";

export interface WalletTransaction {
  id: string;
  kind: WalletTransactionKind;
  title: string;
  subtitle: string;
  amountCents?: number;
  currency?: Currency;
  date: string;
  direction: "in" | "out" | "neutral";
  crypto?: CryptoOrderDetails;
  fiat?: FiatConversionDetails;
  category?: SpendCategory;
  myrRate?: number;
  // Settle-ups: the group they belong to. Older records may not have it.
  groupId?: string;
}

export interface FiatConversionDetails {
  fromCurrency: Currency;
  toCurrency: Currency;
  fromCents: number;
  toCents: number;
  rate: number;
  feeCents: number;
  source: "demo" | "live";
  // Provider timestamp of the live rate used; absent for static demo rates and older records.
  rateUpdatedAt?: string;
  // Bank-transfer previews retain only the display name, bank and final four digits.
  // The full account number is deliberately never saved in JomBit state.
  recipientName?: string;
  recipientBank?: string;
  recipientAccountLast4?: string;
}

export type CryptoPriceSource = "demo" | "coingecko";
export interface CryptoQuote {
  asset: CryptoAsset;
  priceMyr: number;
  change24h: number | null;
  updatedAt: string | null;
  source: CryptoPriceSource;
}
export interface CryptoOrderDetails {
  recipient?: string;
  asset: CryptoAsset;
  quantity: number;
  priceMyr: number | null;
  priceSource: CryptoPriceSource | null;
  priceUpdatedAt: string | null;
  feeCents: number;
  realizedPnlCents?: number | null;
  seeded?: boolean;
}

export interface CryptoHolding {
  asset: CryptoAsset;
  available: number;
  staked: number;
  costBasisCents?: number | null;
  firstBoughtAt?: string | null;
  lastBoughtAt?: string | null;
}

export interface JomBitCard {
  virtualActive: boolean;
  physicalType?: "plastic" | "metal";
  frozen: boolean;
  paymentSource: "fiat" | "crypto";
  paymentAsset?: CryptoAsset;
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

