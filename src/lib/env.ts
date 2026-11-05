import "server-only";

const MIN_PASSWORD_LENGTH = 12;
const MIN_SECRET_LENGTH = 32;

export interface AuthEnv {
  readonly adminPassword: string;
  readonly sessionSecret: string;
}

/** Returns the login settings, or a plain-language list of what is missing. */
export function readAuthEnv(): { ok: true; env: AuthEnv } | { ok: false; problems: string[] } {
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  const sessionSecret = process.env.SESSION_SECRET ?? "";
  const problems = [
    ...(adminPassword.length < MIN_PASSWORD_LENGTH
      ? [`ADMIN_PASSWORD must be set to at least ${MIN_PASSWORD_LENGTH} characters`]
      : []),
    ...(sessionSecret.length < MIN_SECRET_LENGTH
      ? [`SESSION_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters`]
      : []),
  ];
  return problems.length > 0
    ? { ok: false, problems }
    : { ok: true, env: { adminPassword, sessionSecret } };
}

export function hubspotToken(): string | null {
  const token = process.env.HUBSPOT_TOKEN?.trim();
  return token ? token : null;
}

/** DEMO_DATA=1 shows generated sample deals when no HubSpot token is set. */
export function demoMode(): boolean {
  return process.env.DEMO_DATA === "1";
}

/** Demo quota, picked so the sample quarter needs its best-case deals to land. */
const DEMO_QUOTA = 550_000;

/** QUARTER_QUOTA: one quota for every quarter until territories exist. Null when unset. */
export function quarterQuota(): number | null {
  const raw = process.env.QUARTER_QUOTA?.trim();
  const n = raw ? Number(raw) : Number.NaN;
  if (Number.isFinite(n) && n > 0) return n;
  return demoMode() && !hubspotToken() ? DEMO_QUOTA : null;
}
