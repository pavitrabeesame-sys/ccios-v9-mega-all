import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const accounts = await prisma.shopeeAccount.findMany({
      select: { shopId: true },
    });
    return NextResponse.json({
      success: true,
      shopIds: accounts.map(a => String(a.shopId)),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
