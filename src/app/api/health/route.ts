import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      ok: true,
      service: "animematch",
      database: "ready"
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        service: "animematch",
        database: "unavailable"
      },
      { status: 503 }
    );
  }
}
