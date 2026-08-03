import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET(request, { params }) {

  try {

    const review = await prisma.review.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!review) {

      return NextResponse.json(
        { error: "Review not found." },
        { status: 404 }
      );

    }

    return NextResponse.json(review);

  } catch (error) {

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );

  }

}

export async function PATCH(request, { params }) {

  try {

    const body = await request.json();

    const review = await prisma.review.update({
      where: {
        id: params.id,
      },
      data: body,
    });

    return NextResponse.json(review);

  } catch (error) {

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );

  }

}

export async function DELETE(request, { params }) {

  try {

    await prisma.review.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
    });

  } catch (error) {

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );

  }

}