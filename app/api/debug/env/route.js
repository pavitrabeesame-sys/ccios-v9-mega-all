import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    DATABASE_URL: !!process.env.DATABASE_URL,
    SHOPEE_PARTNER_ID: !!process.env.SHOPEE_PARTNER_ID,
    SHOPEE_PARTNER_KEY: !!process.env.SHOPEE_PARTNER_KEY,
    GROQ_API_KEY: !!process.env.GROQ_API_KEY,
  });
}