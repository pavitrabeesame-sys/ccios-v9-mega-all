import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";

// GET all companies
export async function GET() {
  try {
    const companies = await prisma.company.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(companies);
  } catch (error) {
    console.error("GET COMPANY ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to load companies.",
      },
      {
        status: 500,
      }
    );
  }
}

// CREATE company
export async function POST(request) {
  try {
    const body = await request.json();

    const company = await prisma.company.create({
      data: {
        name: body.name,
        code: body.code,
        description: body.description,
      },
    });

    return NextResponse.json(company);
  } catch (error) {
    console.error("CREATE COMPANY ERROR:", error);

    return NextResponse.json(
      {
        error: "Failed to create company.",
      },
      {
        status: 500,
      }
    );
  }
}