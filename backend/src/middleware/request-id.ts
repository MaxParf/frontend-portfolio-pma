import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

export function requestIdHeader(request: IncomingMessage): string {
  const incoming = request.headers["x-request-id"];
  if (typeof incoming === "string" && incoming.trim().length > 0) {
    return incoming;
  }
  return randomUUID();
}
