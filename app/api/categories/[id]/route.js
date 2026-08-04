import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  return NextResponse.json({
    success: true,
    id: params.id,
    message: "Category endpoint is ready",
  });
}

export async function PUT(request, { params }) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    success: true,
    id: params.id,
    data: body,
    message: "Category updated (placeholder)",
  });
}

export async function DELETE(request, { params }) {
  return NextResponse.json({
    success: true,
    id: params.id,
    message: "Category deleted (placeholder)",
  });
}