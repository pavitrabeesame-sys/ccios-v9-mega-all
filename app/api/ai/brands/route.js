// app/api/ai/brands/route.js
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        aiProfile: true,
        company: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(brands);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch AI brand profiles", details: error.message },
      { status: 500 }
    );
  }
}