import { NextResponse } from "next/server";
import { clearCrmCookie } from "@/lib/crm/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearCrmCookie();
  return NextResponse.json({ ok: true });
}
