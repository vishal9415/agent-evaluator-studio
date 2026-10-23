import { getRequestIP } from "@tanstack/react-start/server";

// Process-local brakes for the anonymous homepage demo. This is suitable only
// for local/dev and a single app instance. Multi-instance public deployment
// needs a shared limiter (for example, a database-backed counter or Redis).
const PUBLIC_DEMO_WINDOW_MS = 60 * 60 * 1000;
const PUBLIC_DEMO_MAX_PER_IP_PER_WINDOW = 12;
const PUBLIC_DEMO_GLOBAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const PUBLIC_DEMO_MAX_PER_PROCESS_DAY = 1200;
const publicDemoByIp = new Map<string, { startedAt: number; count: number }>();
let publicDemoGlobalStartedAt = Date.now();
let publicDemoGlobalCount = 0;

export function assertPublicDemoQuota() {
  const now = Date.now();
  if (now - publicDemoGlobalStartedAt >= PUBLIC_DEMO_GLOBAL_WINDOW_MS) {
    publicDemoGlobalStartedAt = now;
    publicDemoGlobalCount = 0;
  }
  if (publicDemoGlobalCount >= PUBLIC_DEMO_MAX_PER_PROCESS_DAY) {
    throw new Error("The public demo has reached its usage limit. Please sign in to use the full Playground.");
  }

  // Trust forwarded-IP data only when the deployment proxy overwrites it.
  const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  let bucket = publicDemoByIp.get(ip);
  if (!bucket || now - bucket.startedAt >= PUBLIC_DEMO_WINDOW_MS) {
    bucket = { startedAt: now, count: 0 };
    publicDemoByIp.set(ip, bucket);
  }
  if (bucket.count >= PUBLIC_DEMO_MAX_PER_IP_PER_WINDOW) {
    throw new Error("This public demo is rate-limited. Please try again later or sign in to the Playground.");
  }

  bucket.count += 1;
  publicDemoGlobalCount += 1;
  if (publicDemoByIp.size > 2000) {
    for (const [key, value] of publicDemoByIp.entries()) {
      if (now - value.startedAt >= PUBLIC_DEMO_WINDOW_MS) publicDemoByIp.delete(key);
    }
  }
}
