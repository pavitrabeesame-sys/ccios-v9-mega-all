import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST(request) {
  try {
    const { ids, action } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No reviews selected." },
        { status: 400 }
      );
    }

    let status = "PENDING";

    if (action === "approve") status = "APPROVED";
    if (action === "reject") status = "REJECTED";
    if (action === "replied") status = "REPLIED";

    await prisma.review.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        status,
      },
    });

    return NextResponse.json({
      success: true,
      updated: ids.length,
    });

  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}