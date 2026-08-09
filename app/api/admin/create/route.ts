import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { adminId, password, name } = await req.json();

    if (!adminId || !password) {
      return NextResponse.json({ success: false, error: 'Admin ID and password are required' }, { status: 400 });
    }

    const existing = await prisma.adminUser.findUnique({
      where: { adminId },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: 'Admin ID already exists' }, { status: 400 });
    }

    const newAdmin = await prisma.adminUser.create({
      data: {
        adminId,
        password,
        name: name || 'Admin',
      },
    });

    return NextResponse.json({ success: true, adminId: newAdmin.adminId });
  } catch (error: any) {
    console.error('Create admin error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
