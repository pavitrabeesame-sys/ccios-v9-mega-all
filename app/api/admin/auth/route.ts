// app/api/admin/auth/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { adminId, password } = await req.json();

    if (!adminId || !password) {
      return NextResponse.json(
        { success: false, error: "Missing credentials" },
        { status: 400 }
      );
    }

    // Hash the incoming password fresh
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upsert ensures the admin always exists with the correct password
    const admin = await prisma.adminUser.upsert({
      where: { adminId },
      update: { password: hashedPassword },
      create: {
        adminId,
        password: hashedPassword,
        name: "Pavitra",
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        adminId: admin.adminId,
        name: admin.name,
      },
    });
  } catch (error: any) {
    console.error("Error authenticating/creating admin:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}