import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

// =========================
// GET STORE
// =========================
export async function GET(request, { params }) {
  try {
    const store = await prisma.store.findUnique({
      where: {
        id: params.id,
      },
      include: {
        company: true,
        orders: true,
      },
    });

    if (!store) {
      return NextResponse.json(
        {
          success: false,
          message: "Store not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load store.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// UPDATE STORE
// =========================
export async function PUT(request, { params }) {
  try {
    const body = await request.json();

    const store = await prisma.store.update({
      where: {
        id: params.id,
      },
      data: {
        name: body.name,
        marketplace: body.marketplace,
        companyId: body.companyId,
      },
    });

    return NextResponse.json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update store.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// DELETE STORE
// =========================
export async function DELETE(request, { params }) {
  try {
    await prisma.store.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Store deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete store.",
      },
      {
        status: 500,
      }
    );
  }
}