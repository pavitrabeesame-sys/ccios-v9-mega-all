import { NextResponse } from "next/server";

export async function GET() {

  const analytics = await fetch(
    `${process.env.NEXTAUTH_URL}/api/reviews/analytics`
  );

  return NextResponse.json(await analytics.json());

}