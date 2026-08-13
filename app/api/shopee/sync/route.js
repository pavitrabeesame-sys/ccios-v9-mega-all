import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Endpoint ready"
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    success: true,
    message: "Endpoint ready",
    data: body
  });
}
