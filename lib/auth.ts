import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "life_regime_session";
const SESSION_DAYS = 30;

type SessionPayload = {
  userId: string;
  exp: number;
};

function signingSecret() {
  const configuredSecret = process.env.AUTH_SECRET || process.env.APP_ACCESS_KEY;
  if (configuredSecret) return configuredSecret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET and APP_ACCESS_KEY are not configured");
  }
  return "dev-only-life-regime-secret";
}

/**
 * Defaults to NODE_ENV === "production" like before. Set COOKIE_SECURE=false
 * when serving production over plain HTTP (no domain/TLS yet) — browsers
 * silently drop Secure cookies on non-HTTPS origins, which breaks login.
 */
function isSecureCookieEnabled() {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

function accessKey() {
  if (process.env.APP_ACCESS_KEY) return process.env.APP_ACCESS_KEY;
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_ACCESS_KEY is not configured");
  }
  return "dev-access-key";
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function decode(token?: string): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", signingSecret()).update(body).digest("base64url");
  const providedSignature = Buffer.from(sig);
  const expectedSignature = Buffer.from(expected);
  if (providedSignature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(providedSignature, expectedSignature)) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const session = payload as Partial<SessionPayload>;
    if (typeof session.userId !== "string" || typeof session.exp !== "number") return null;
    if (!Number.isFinite(session.exp) || session.exp < Date.now()) return null;
    return { userId: session.userId, exp: session.exp };
  } catch {
    return null;
  }
}

export async function ensureLocalUser() {
  const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.user.create({ data: { label: "Local user" } });
}

export async function createSessionCookie(userId: string) {
  const jar = await cookies();
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  jar.set(COOKIE_NAME, encode({ userId, exp }), {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureCookieEnabled(),
    path: "/",
    expires: new Date(exp)
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const jar = await cookies();
  const session = decode(jar.get(COOKIE_NAME)?.value);
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function authenticateAccessKey(candidate: string) {
  const expected = accessKey();
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return ensureLocalUser();
}

export function isUsingDevAccessKey() {
  return !process.env.APP_ACCESS_KEY;
}
