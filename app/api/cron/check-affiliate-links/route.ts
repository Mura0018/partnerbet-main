import { NextRequest, NextResponse } from "next/server";
import { runLinkHealthCheck } from "@/lib/affiliates/runLinkHealthCheck";

// Scheduled automatic check (see vercel.json for the cron schedule).
// Authenticated via CRON_SECRET rather than a user session, since Vercel
// Cron has no browser/session context. Set CRON_SECRET in your Vercel
// project's environment variables — Vercel automatically sends it as a
// Bearer token to routes configured in vercel.json's "crons" list.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runLinkHealthCheck();
  return NextResponse.json(result);
}
