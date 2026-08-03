import { prisma } from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "Database Connected" });
  } catch (error) {
    return NextResponse.json(
      {
        status: "Database Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}