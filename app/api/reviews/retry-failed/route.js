export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    // Find and reset failed reviews back to PENDING status for reprocessing
    const updateResult = await prisma.review.updateMany({
      where: { status: 'FAILED' },
      data: { status: 'PENDING' },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully reset ${updateResult.count} failed reviews to PENDING.`,
      count: updateResult.count,
    });
  } catch (error) {
    console.error('[Retry-Failed API Error]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}