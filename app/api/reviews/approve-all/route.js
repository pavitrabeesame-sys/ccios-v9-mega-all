import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function POST() {

  try {

    const result = await prisma.review.updateMany({

      where: {
        status: "GENERATED",
      },

      data: {
        status: "APPROVED",
      },

    });

    return NextResponse.json({
      success: true,
      approved: result.count,
    });

  } catch (error) {

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );

  }

}