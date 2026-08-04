import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Knowledge API is ready",
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    success: true,
    message: "Knowledge API is ready",
    data: body,
  });
}