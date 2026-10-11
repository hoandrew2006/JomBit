import { hostedFxRatesApi } from "../../server/hosted-fx-rates.mjs";

export default function handler(req, res) {
  return hostedFxRatesApi(req, res);
}
