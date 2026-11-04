import { describe, expect, test } from "vitest";
import { clientIp, createRateLimiter } from "@/lib/rateLimit";
import {
  createSessionToken,
  passwordMatches,
  SESSION_TTL_MS,
  verifySessionToken,
} from "@/lib/session";

const SECRET = "x".repeat(32);

describe("session tokens", () => {
  test("verify until they expire", () => {
    const token = createSessionToken(SECRET, 1_000);
    expect(verifySessionToken(SECRET, token, 1_000)).toBe(true);
    expect(verifySessionToken(SECRET, token, 1_000 + SESSION_TTL_MS)).toBe(false);
  });

  test("reject tampering, other secrets and garbage", () => {
    const token = createSessionToken(SECRET, 1_000);
    const [, sig] = token.split(".");
    expect(verifySessionToken(SECRET, `${Date.now() + 10 ** 9}.${sig}`)).toBe(false);
    expect(verifySessionToken("y".repeat(32), token, 1_000)).toBe(false);
    expect(verifySessionToken(SECRET, undefined)).toBe(false);
    expect(verifySessionToken(SECRET, "nonsense")).toBe(false);
  });

  test("passwords compare exactly", () => {
    expect(passwordMatches("correct horse", "correct horse")).toBe(true);
    expect(passwordMatches("correct horse", "correct hors")).toBe(false);
  });
});

describe("rate limiter", () => {
  test("blocks after the limit until the window passes or it is reset", () => {
    const limiter = createRateLimiter(2, 1_000);
    expect([limiter.attempt("ip", 0), limiter.attempt("ip", 1), limiter.attempt("ip", 2)]).toEqual([
      true,
      true,
      false,
    ]);
    expect(limiter.attempt("ip", 1_001)).toBe(true);
    limiter.reset("ip");
    expect(limiter.attempt("ip", 1_002)).toBe(true);
  });

  test("trusts only the last forwarded address", () => {
    expect(clientIp("1.1.1.1, 2.2.2.2")).toBe("2.2.2.2");
    expect(clientIp(null)).toBe("unknown");
  });
});
