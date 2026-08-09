import { NextResponse } from 'next/server';
// Adjust relative path if prisma.ts is at src/lib/prisma.ts vs lib/prisma.ts:
import { prisma } from '../../../lib/prisma'; // or '../../../src/lib/prisma'

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews);
  } catch (error: any) {
    console.error('API Error fetching reviews:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}