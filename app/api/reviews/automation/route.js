import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    autoReply5Star: true,
    autoReply4Star: true,
    autoReply3Star: false,
    autoReply2Star: false,
    autoReply1Star: false,
    requireApproval: true,
    languageDetection: true,
    brandVoice: true,
  });
}

export async function POST(request) {
  const body = await request.json();

  return NextResponse.json({
    success: true,
    settings: body,
  });
}