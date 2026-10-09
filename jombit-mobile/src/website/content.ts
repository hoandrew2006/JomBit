// Replace null with the official listing URL when each JomBit app is published.
// Preview QRs contain explanatory text, never an invented store listing.
export const storeLinks: { ios: string | null; android: string | null } = {
  ios: null,
  android: null,
};

export const productTabs = [
  {
    id: "split",
    label: "Split a receipt",
    eyebrow: "EVERY ITEM. EVERY PERSON. EVERY CENT.",
    title: "Your order. Your share.",
    description: "One friend had a drink. Another ordered the whole menu. JomBit lets you assign each item to the people who actually shared it, so a fair split doesn’t have to mean an equal split.",
    points: [
      "Capture a receipt with the camera; scan with Gemini after local setup.",
      "Assign a dish to one person, a few friends, or everyone.",
      "Share SST and service charges proportionally, down to the cent.",
    ],
  },
  {
    id: "track",
    label: "Keep the group in sync",
    eyebrow: "ONE GROUP. ONE CLEAR PICTURE.",
    title: "More memories. Less maths.",
    description: "Dinner, a taxi, the hotel, and that last-minute snack run. Keep your shared expenses together, see who paid, and know where everyone stands as the trip unfolds.",
    points: [
      "Create groups for trips, housemates, or your regular dinner crew.",
      "See each person’s balance alongside a shared expense history.",
      "Update a bill and the whole group’s balances follow.",
    ],
  },
  {
    id: "settle",
    label: "Settle with less effort",
    eyebrow: "LESS BACK-AND-FORTH. MORE ALL SQUARE.",
    title: "A simpler way to settle up.",
    description: "JomBit looks at the group’s overall balances and works out a smaller set of payments. You see who should pay whom, instead of untangling every expense yourself.",
    points: [
      "Combine multiple expenses into clear payment suggestions.",
      "Preview a QR settlement journey designed for Malaysia.",
      "Record a demo payment and see the group ledger update.",
    ],
  },
] as const;

export const questions = [
  {
    question: "What is JomBit?",
    answer: "JomBit is a group-expense and fintech app concept built around sharing money more fairly. Receipt splitting, a shared group ledger, and simplified settlements are the core experience. The wider vision brings together separate fiat and crypto wallets, regional transfers, and a prepaid card.",
  },
  {
    question: "How does JomBit split a bill fairly?",
    answer: "Each receipt item can be assigned to one person or shared by several people. JomBit divides shared items evenly, then allocates SST and service charges according to each person’s item subtotal. Deterministic cent-level rounding keeps everyone’s shares equal to the exact receipt total.",
  },
  {
    question: "What if different people pay for different expenses?",
    answer: "That’s what the group ledger is for. JomBit compares what each person paid with what they owe across all group expenses, then suggests a smaller set of payments between members. You don’t have to repay every individual receipt separately.",
  },
  {
    question: "Can I use JomBit for travel and different currencies?",
    answer: "Deposit MYR into one JomBit Fiat Wallet, then see what the same balance is worth in SGD, THB and IDR. Those figures are estimates, not extra balances. For a simulated foreign-currency transfer, review the MYR deduction before confirming. The prototype uses static demo rates and does not connect to a bank or move real funds.",
  },
  {
    question: "Is JomBit available on the App Store and Google Play?",
    answer: "JomBit’s iOS and Android apps are coming soon. The download section currently shows preview QR codes, not live store links. These will connect to the official App Store and Google Play listings when the app is published.",
  },
  {
    question: "Are the payment, crypto and card services live?",
    answer: "No. Payments, FX rates, crypto staking and card issuance are simulated. JomBit does not offer crypto buying or selling. Receipt calculations, local group balances and debt simplification work. Camera capture and Gemini receipt recognition work in the configured local app, but this website’s walkthrough uses sample data. No real money or crypto is transferred. Demo settlement QRs are not valid PayNet payment QRs.",
  },
  {
    question: "What is the vision for JomBit Crypto Wallet?",
    answer: "Staking existing eligible crypto, not buying or selling it. We plan a Luno integration, but no partnership or account connection is confirmed. Today you can simulate staking and unstaking ETH or SOL; BTC holdings remain view-only. Existing purchase dates, costs and activity are preserved as historical information. CoinGecko reference prices or demo prices are for valuation, not rewards. No real staking rewards accrue. The JomBit Card remains a separate fiat-funded concept.",
  },
  {
    question: "Is JomBit connected to Luno, and are staking rewards guaranteed?",
    answer: "No. The Luno integration is planned and requires provider approval and technical implementation. The prototype never asks for Luno credentials or sends it account data. Future asset eligibility, fees, reward estimates and unstaking periods must be checked with the provider before staking. Rewards are not guaranteed and crypto values can fall. Immediate balance changes in this demo do not represent real provider processing times.",
  },
  {
    question: "Does this website upload my receipts or sync a live group?",
    answer: "No. The website walkthrough uses fictional receipt data and sends nothing to Gemini. In the separate local app, you choose and approve a photo before the configured backend sends it to Google. Review all AI-extracted fields before saving. The prototype stores its ledger on your device, not in a shared cloud account; real-time collaboration between friends is not implemented yet.",
  },
] as const;
