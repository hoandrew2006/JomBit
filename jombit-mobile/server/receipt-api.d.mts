import type { IncomingMessage, ServerResponse } from "node:http";
export function createReceiptApi(options?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; hosted?: boolean; now?: () => number; timeoutMs?: number }): (req: IncomingMessage, res: ServerResponse, next?: () => void) => Promise<void>;
