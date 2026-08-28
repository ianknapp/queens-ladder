import { createHmac, timingSafeEqual } from "node:crypto";
import { captureSecret, sitePassword } from "@/lib/env";

const COOKIE = "ql_session";

function hmac(value: string) {
  const secret = captureSecret() || "local-dev-only";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function sessionCookieName() {
  return COOKIE;
}

export function sessionToken() {
  return hmac(`site:${sitePassword()}`);
}

export function siteIsLocked() {
  return sitePassword().length > 0;
}

export function verifySitePassword(input: string) {
  const expected = sitePassword();
  if (!expected) return true;
  const left = Buffer.from(hmac(input));
  const right = Buffer.from(hmac(expected));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifySession(token: string | undefined) {
  if (!siteIsLocked()) return true;
  if (!token) return false;
  const left = Buffer.from(token);
  const right = Buffer.from(sessionToken());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyCaptureSecret(header: string | null) {
  const expected = captureSecret();
  if (!expected) return false;
  if (!header) return false;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
