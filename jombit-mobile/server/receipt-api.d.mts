import type { IncomingMessage, ServerResponse } from "node:http";
export function createReceiptApi(options?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number }): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<void>;
