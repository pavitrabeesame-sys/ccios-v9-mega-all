// app/api/lazada/test/route.js

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Lazada API route is available.",
  });
}