export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const auth = request.headers.get("authorization");
    if (process.env.CRON_SECRET && auth!== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log("[CRON] Starting CCIOS Cron...");
    
    const reviews = await prisma.review.findMany({ 
      where: { 
        status: 'PENDING', 
        marketplace: 'SHOPEE' // fixed
      },
      take: 5 
    });

    console.log(`[Shopee] Found ${reviews.length} pending reviews`);

    for (const review of reviews) {
      console.log(`[AIReply] Would generate reply for review: ${review.id}`);
    }

    return NextResponse.json({
      success: true,
      processed: reviews.length,
      executedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error("========== CRON ERROR ==========");
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}