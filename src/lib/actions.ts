"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { endSession, passwordMatches, requireSession, startSession } from "./auth";
import { clearDashboardCache } from "./data";
import { readAuthEnv } from "./env";
import { clientIp, createRateLimiter } from "./rateLimit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginLimiter = createRateLimiter(10, LOGIN_WINDOW_MS);
const globalLoginLimiter = createRateLimiter(100, LOGIN_WINDOW_MS);

export interface FormState {
  error?: string;
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const auth = readAuthEnv();
  if (!auth.ok) return { error: `Login is not configured: ${auth.problems.join("; ")}` };
  const ip = clientIp((await headers()).get("x-forwarded-for"));
  if (!globalLoginLimiter.attempt("all") || !loginLimiter.attempt(ip))
    return { error: "Too many attempts. Try again in 15 minutes." };
  if (!passwordMatches(auth.env.adminPassword, String(form.get("password") ?? ""))) {
    return { error: "Wrong password." };
  }
  loginLimiter.reset(ip);
  await startSession(auth.env.sessionSecret);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function refreshAction(): Promise<void> {
  await requireSession();
  clearDashboardCache();
  revalidatePath("/", "layout");
}
