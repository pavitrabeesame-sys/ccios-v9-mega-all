export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Health Check Error]:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        database: 'disconnected',
        error: error.message,
      },
      { status: 500 }
    );
  }
}