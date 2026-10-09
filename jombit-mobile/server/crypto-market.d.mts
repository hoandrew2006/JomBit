import type { IncomingMessage, ServerResponse } from "node:http";
export function createCryptoMarketApi(): (req: IncomingMessage, res: ServerResponse, next: () => void) => Promise<void>;
