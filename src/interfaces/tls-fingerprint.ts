/**
 * Curated TLS/HTTP fingerprint captured from a TLS-inspection endpoint
 * (e.g. https://tls.peet.ws/api/all). Exposes the most commonly used
 * identifiers (ja3/ja4, akamai http2, request headers) and keeps the full
 * upstream payload under `raw` for anything not promoted to a top field.
 */
export interface TlsFingerprint {
  /** ISO timestamp of when the capture ran. */
  capturedAt: string;
  /** Source IP:port as seen by the endpoint. */
  ip: string;
  /** Negotiated HTTP version, e.g. 'h2'. */
  httpVersion: string;
  /** HTTP method of the capture request. */
  method: string;
  /** User-Agent the browser sent. */
  userAgent: string;
  /** JA3 fingerprint string. */
  ja3: string;
  /** JA3 MD5 hash. */
  ja3Hash: string;
  /** JA4 fingerprint string. */
  ja4: string;
  /** JA4_r (raw) fingerprint string, when present. */
  ja4_r?: string;
  /** peetprint fingerprint string. */
  peetprint: string;
  /** peetprint hash. */
  peetprintHash: string;
  /** Offered TLS cipher suites. */
  ciphers: string[];
  /** TLS extension names, in offered order. */
  tlsExtensions: string[];
  /** HTTP/2 Akamai fingerprint string. */
  akamaiFingerprint: string;
  /** HTTP/2 Akamai fingerprint hash. */
  akamaiFingerprintHash: string;
  /** Request pseudo/normal headers from the HTTP/2 HEADERS frame. */
  headers: string[];
  /** Full unmodified upstream response. */
  raw: Record<string, unknown>;
}
