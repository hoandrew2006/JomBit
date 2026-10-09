import { hostedReceiptApi } from "../../server/hosted-receipt.mjs";

export default function handler(req, res) {
  return hostedReceiptApi(req, res);
}
