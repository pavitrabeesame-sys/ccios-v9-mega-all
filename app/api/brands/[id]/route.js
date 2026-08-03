import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

// =========================
// GET BRAND
// =========================
export async function GET(request, { params }) {
  try {
    const brand = await prisma.brand.findUnique({
      where: {
        id: params.id,
      },
      include: {
        company: true,
        products: true,
      },
    });

    if (!brand) {
      return NextResponse.json(
        {
          success: false,
          message: "Brand not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load brand.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// UPDATE BRAND
// =========================
export async function PUT(request, { params }) {
  try {
    const body = await request.json();

    const brand = await prisma.brand.update({
      where: {
        id: params.id,
      },
      data: {
        name: body.name,
        code: body.code,
        description: body.description,
        companyId: body.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      data: brand,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update brand.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// DELETE BRAND
// =========================
export async function DELETE(request, { params }) {
  try {
    await prisma.brand.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Brand deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete brand.",
      },
      {
        status: 500,
      }
    );
  }
}