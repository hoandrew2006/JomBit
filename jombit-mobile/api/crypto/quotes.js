import { hostedCryptoMarketApi } from "../../server/hosted-crypto-market.mjs";

export default function handler(req, res) {
  return hostedCryptoMarketApi(req, res);
}
