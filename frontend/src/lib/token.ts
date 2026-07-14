// Stateless document tokens: the extracted text is gzipped + base64url-encoded
// and carried by the client between /api/upload and /api/analyze. This keeps the
// API fully stateless (no database, no cross-request memory) so it runs on any
// serverless platform without a backend.
import { gunzipSync, gzipSync } from "node:zlib";

export interface DocPayload {
  n: string; // filename
  p: number; // pages
  t: string; // extracted text
}

export function encodeDoc(doc: DocPayload): string {
  const json = Buffer.from(JSON.stringify(doc), "utf8");
  return gzipSync(json).toString("base64url");
}

export function decodeDoc(token: string): DocPayload {
  const buf = gunzipSync(Buffer.from(token, "base64url"));
  return JSON.parse(buf.toString("utf8")) as DocPayload;
}
