import { prisma } from "../../../lib/prisma.js";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const brand = searchParams.get("brand");
  const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: dateFrom } };
  if(brand) where.brand = brand;

  const [total, today, avg, byStatus] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.count({ where: { ...where, createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
    prisma.review.aggregate({ where, _avg: { rating: true } }),
    prisma.review.groupBy({ by: ["status"], where, _count: true })
  ]);

  return NextResponse.json({
    total_reviews: total,
    today_reviews: today,
    avg_rating: Number(avg._avg.rating || 0).toFixed(2),
    by_status: byStatus
  });
}