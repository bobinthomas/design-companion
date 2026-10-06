import { NextResponse } from "next/server";
import { clientIp, getBindings } from "@/lib/cloudflare";
import { getQuota } from "@/lib/decision-model/quota";
import { POLICY } from "@/lib/knowledge";

/** Remaining shared-binding Jev requests for the caller today. */
export async function GET(request: Request) {
  const { AI, JEV_QUOTA } = await getBindings();
  if (!AI || !JEV_QUOTA) {
    return NextResponse.json({ available: false });
  }
  const status = await getQuota(JEV_QUOTA, clientIp(request), POLICY.quota.jevRequestsPerIpPerDay);
  return NextResponse.json({ available: true, ...status });
}
