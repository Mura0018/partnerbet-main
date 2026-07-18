import { NextRequest, NextResponse } from "next/server";
import { getActiveFootballProvider } from "@/lib/football/registry";
import { withFootballCache } from "@/lib/football/cache";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const provider = await getActiveFootballProvider();
  if (!provider) return NextResponse.json({ configured: false, fixture: null });

  try {
    const fixture = await withFootballCache(`fixture:${id}`, provider.id, 60, () => provider.getFixtureById(id));
    return NextResponse.json({ configured: true, fixture: fixture ?? null });
  } catch {
    return NextResponse.json({ configured: true, fixture: null, error: "provider_error" });
  }
}
