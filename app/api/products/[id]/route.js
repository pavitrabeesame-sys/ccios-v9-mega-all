import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  return NextResponse.json({
    success: true,
    id: params.id,
    message: "Product endpoint ready"
  });
}

export async function PUT(request, { params }) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    success: true,
    id: params.id,
    data: body
  });
}

export async function DELETE(request, { params }) {
  return NextResponse.json({
    success: true,
    id: params.id
  });
}