import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

// GET
export async function GET() {
  const templates = await prisma.replyTemplate.findMany({
    orderBy: {
      brand: "asc",
    },
  });

  return NextResponse.json(templates);
}

// POST
export async function POST(request) {
  const body = await request.json();

  const template = await prisma.replyTemplate.create({
    data: {
      brand: body.brand,
      rating: body.rating,
      title: body.title,
      template: body.template,
    },
  });

  return NextResponse.json(template);
}