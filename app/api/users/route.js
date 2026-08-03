import { NextResponse } from "next/server";
import { prisma } from "../../../src/lib/prisma";
import bcrypt from "bcryptjs";

// =========================
// GET USERS
// =========================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";

    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            email: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      },

      include: {
        company: true,
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: users,
    });

  } catch (error) {

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load users.",
      },
      {
        status: 500,
      }
    );

  }
}

// =========================
// CREATE USER
// =========================
export async function POST(request) {

  try {

    const body = await request.json();

    const hashedPassword = await bcrypt.hash(body.password, 12);

    const user = await prisma.user.create({

      data: {

        name: body.name,

        email: body.email,

        password: hashedPassword,

        role: body.role,

        companyId: body.companyId,

      },

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
        message: "Failed to create user.",
      },
      {
        status: 500,
      }
    );

  }

}