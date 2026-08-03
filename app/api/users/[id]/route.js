import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import bcrypt from "bcryptjs";

// =========================
// GET USER
// =========================
export async function GET(request, { params }) {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: params.id,
      },
      include: {
        company: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "User not found.",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load user.",
      },
      {
        status: 500,
      }
    );
  }
}

// =========================
// UPDATE USER
// =========================
export async function PUT(request, { params }) {
  try {
    const body = await request.json();

    const data = {
      name: body.name,
      email: body.email,
      role: body.role,
      companyId: body.companyId,
      isActive: body.isActive,
    };

    if (body.password && body.password.trim() !== "") {
      data.password = await bcrypt.hash(body.password, 12);
    }

    const user = await prisma.user.update({
      where: {
        id: params.id,
      },
      data,
    });

    return NextResponse.json({
      success: true,
      data: user,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update user.",
      },
      {
        status: 500,
      }
    );

  }
}

// =========================
// DELETE USER
// =========================
export async function DELETE(request, { params }) {
  try {
    await prisma.user.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "User deleted successfully.",
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete user.",
      },
      {
        status: 500,
      }
    );

  }
}