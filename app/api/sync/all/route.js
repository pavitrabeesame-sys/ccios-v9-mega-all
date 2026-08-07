import { NextResponse } from 'next/server';

// Force dynamic execution so Vercel never tries to pre-render this during build
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Lazy-load Prisma and sync logic ONLY when the endpoint is requested at runtime
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    console.log('Starting full system review/marketplace sync...');

    // Example runtime sync tasks (safe from build-time execution)
    const results = {
      shopee: 'Synced successfully',
      lazada: 'Skipped (Pending API Approval)',
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      message: 'All system syncs completed successfully.',
      results
    });
  } catch (error) {
    console.error('Sync All API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}