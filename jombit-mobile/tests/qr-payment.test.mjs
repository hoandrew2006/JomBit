import assert from "node:assert/strict";
import test from "node:test";
import { buildSampleDuitNowQr, parseDuitNowQr, qrChecksum } from "../lib/duitnow-qr.ts";
import { CRYPTO_PAYMENT_SPREAD_BASIS_POINTS, LUNO_EXCHANGE_FEES_BASIS_POINTS, cryptoPaymentFeeCents, executeQrPayment, quoteQrPayment } from "../lib/qr-payment.ts";
import { insightEntries } from "../lib/insights.ts";

const NOW = Date.parse("2026-10-19T04:00:00.000Z");
const quote = { asset: "ETH", priceMyr: 10000, change24h: 0, updatedAt: new Date(NOW - 20_000).toISOString(), source: "coingecko" };
const state = () => ({
  user: { id: "me", name: "Aisha", defaultCurrency: "MYR", onboarded: true },
  members: {}, groups: [], expenses: [], settlements: [], counterpartBalances: {},
  fiatBalances: { MYR: 10000, SGD: 0, THB: 0, IDR: 0 },
  crypto: { ETH: { asset: "ETH", available: 0.05, staked: 0.05, costBasisCents: 100000, firstBoughtAt: null, lastBoughtAt: null } },
  walletTransactions: [],
  card: { virtualActive: false, frozen: false, paymentSource: "fiat" },
});
const shop = parseDuitNowQr(buildSampleDuitNowQr({ name: "Kopitiam Sample", city: "Petaling Jaya" }));

test("DuitNow QR codes are read with their payee, city, fixed amount and checksum", () => {
  assert.deepEqual(shop, { payeeName: "Kopitiam Sample", payeeCity: "Petaling Jaya", amountCents: null, reference: null, dynamic: false, sample: true });
  const bill = parseDuitNowQr(buildSampleDuitNowQr({ name: "Nasi Lemak Sample", amountCents: 1850, reference: "TABLE-12" }));
  assert.deepEqual([bill.amountCents, bill.reference, bill.dynamic], [1850, "TABLE-12", true]);
  // A real-looking (non-sample) Malaysian EMVCo QR is accepted but marked as not a sample.
  const body = "000201010211" + "2634" + "0014A000000615000101" + "0110" + "1234567890" + "520458125303458" + "5802MY" + "5910Real Kedai" + "6012Kuala Lumpur" + "6304";
  const real = parseDuitNowQr(body + qrChecksum(body));
  assert.deepEqual([real.payeeName, real.sample], ["Real Kedai", false]);
  const sample = buildSampleDuitNowQr({ name: "Kopitiam Sample" });
  assert.throws(() => parseDuitNowQr(sample.slice(0, -1) + (sample.endsWith("0") ? "1" : "0")), /couldn't be read correctly/);
  assert.throws(() => parseDuitNowQr("https://example.com/not-a-payment-qr"), /isn't a valid DuitNow QR/);
  const foreign = "000201010211" + "5303702" + "5802SG" + "5905Store" + "6009Singapore" + "6304";
  assert.throws(() => parseDuitNowQr(foreign + qrChecksum(foreign)), /Only Malaysian DuitNow QR/);
});

test("Paying with cash takes the amount from the MYR wallet and records one payment", () => {
  const result = executeQrPayment(state(), { id: "p1", qr: shop, amount: "12.50", method: "cash", category: "food" }, NOW);
  assert.equal(result.fiatBalances.MYR, 10000 - 1250);
  const [tx] = result.walletTransactions;
  assert.deepEqual([tx.kind, tx.title, tx.amountCents, tx.category, tx.direction], ["payment", "Kopitiam Sample", 1250, "food", "out"]);
  assert.match(tx.subtitle, /Sample DuitNow QR · paid from MYR wallet · preview/);
  assert.equal(result.crypto.ETH.available, 0.05, "crypto is untouched");
  assert.throws(() => executeQrPayment(result, { id: "p1", qr: shop, amount: "1", method: "cash", category: "food" }, NOW), /already recorded/);
  assert.throws(() => executeQrPayment(state(), { id: "p2", qr: shop, amount: "100.01", method: "cash", category: "food" }, NOW), /MYR balance is too low/);
  assert.throws(() => executeQrPayment(state(), { id: "p3", qr: shop, amount: "0", method: "cash", category: "food" }, NOW), /greater than zero/);
  assert.throws(() => executeQrPayment(state(), { id: "p4", qr: shop, amount: "5", method: "cash", category: "fees" }, NOW), /category/);
});

test("A fixed-amount QR always pays the QR's amount", () => {
  const bill = parseDuitNowQr(buildSampleDuitNowQr({ name: "Nasi Lemak Sample", amountCents: 1850 }));
  const result = executeQrPayment(state(), { id: "b1", qr: bill, amount: "1.00", method: "cash", category: "food" }, NOW);
  assert.equal(result.walletTransactions[0].amountCents, 1850);
});

test("JomBit's spread is a percentage that stays below Luno's Exchange maker and taker fees on every amount", () => {
  assert.ok(CRYPTO_PAYMENT_SPREAD_BASIS_POINTS < LUNO_EXCHANGE_FEES_BASIS_POINTS.maker, "below Luno's maker fee");
  assert.ok(CRYPTO_PAYMENT_SPREAD_BASIS_POINTS < LUNO_EXCHANGE_FEES_BASIS_POINTS.taker, "below Luno's taker fee");
  const lowest = Math.min(LUNO_EXCHANGE_FEES_BASIS_POINTS.maker, LUNO_EXCHANGE_FEES_BASIS_POINTS.taker) / 10_000;
  // Rounding never pushes the charge above the percentage, even on small amounts.
  for (let cents = 1; cents <= 500_000; cents++) {
    const fee = cryptoPaymentFeeCents(cents);
    if (fee > (cents * CRYPTO_PAYMENT_SPREAD_BASIS_POINTS) / 10_000 || fee / cents >= lowest) assert.fail(`spread on ${cents} sen is ${fee} sen`);
  }
});

test("Paying with crypto converts the coin at the reviewed price plus JomBit's spread", () => {
  assert.equal(cryptoPaymentFeeCents(4500), 13, "0.30% of RM45.00 is RM0.135, rounded down to RM0.13");
  assert.equal(cryptoPaymentFeeCents(100), 0, "0.30% of RM1.00 is less than one sen");
  const result = executeQrPayment(state(), { id: "c1", qr: shop, amount: "45.00", method: "crypto", asset: "ETH", quote, category: "food" }, NOW);
  const [tx] = result.walletTransactions;
  // (RM45.00 + RM0.13) / RM10,000 per ETH = 0.004513 ETH.
  assert.deepEqual([tx.kind, tx.amountCents, tx.crypto.asset, tx.crypto.quantity, tx.crypto.feeCents, tx.crypto.priceMyr], ["crypto-payment", 4500, "ETH", 0.004513, 13, 10000]);
  assert.equal(result.crypto.ETH.available, 0.045487);
  assert.equal(result.crypto.ETH.staked, 0.05, "staked crypto is never used");
  assert.equal(result.fiatBalances.MYR, 10000, "the MYR wallet is untouched");
  assert.equal(result.crypto.ETH.costBasisCents, Math.round(100000 * (0.1 - 0.004513) / 0.1));
  // In Insights: one Food & Drink entry for what the recipient got, plus the spread under Fees.
  const entries = insightEntries(result);
  assert.deepEqual(entries.map((entry) => [entry.category, entry.myrCents, entry.flow]), [["food", 4500, "out"], ["fees", 13, "out"]]);
});

test("Coin amounts for cheap coins use the exact price and always cover the recipient", () => {
  const ada = { ...quote, asset: "ADA", priceMyr: 2.5137 };
  const holder = state(); holder.crypto.ADA = { asset: "ADA", available: 500, staked: 0, costBasisCents: 0, firstBoughtAt: null, lastBoughtAt: null };
  const { cryptoUnits, feeCents } = quoteQrPayment(holder, { id: "a", qr: shop, amount: "45.00", method: "crypto", asset: "ADA", quote: ada, category: "food" }, NOW);
  const myr = (cryptoUnits / 1e8) * 2.5137;
  assert.ok(myr * 100 >= 4500 + feeCents && myr * 100 < 4500 + feeCents + 0.01, `${myr} MYR covers RM45.00 + spread without overcharging`);
});

test("Crypto payments need a current price, the chosen coin and enough available balance", () => {
  const pay = (changes) => quoteQrPayment(state(), { id: "x", qr: shop, amount: "45.00", method: "crypto", asset: "ETH", quote, category: "food", ...changes }, NOW);
  assert.throws(() => pay({ quote: undefined }), /current price/);
  assert.throws(() => pay({ quote: { ...quote, updatedAt: new Date(NOW - 10 * 60_000).toISOString() } }), /current price/);
  assert.throws(() => pay({ quote: { ...quote, asset: "SOL" } }), /current price/);
  assert.throws(() => pay({ asset: undefined }), /Choose which crypto/);
  assert.throws(() => pay({ amount: "600.00" }), /Not enough available ETH/, "0.05 ETH available covers about RM498; staked ETH doesn't count");
  assert.throws(() => pay({ amount: "5000.01" }), /limited to RM5,000/);
});
