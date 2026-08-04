import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      "http://localhost:3000";

    const steps = [];

    // STEP 1 - Sync Reviews
    let res = await fetch(`${baseUrl}/api/shopee/reviews/sync`);
    let data = await res.json();

    steps.push({
      step: "Sync Reviews",
      success: res.ok,
      result: data,
    });

    // STEP 2 - Generate AI Replies
    res = await fetch(`${baseUrl}/api/reviews/generate-all`, {
      method: "POST",
    });

    data = await res.json();

    steps.push({
      step: "Generate Replies",
      success: res.ok,
      result: data,
    });

    // STEP 3 - Reply Approved Reviews
    res = await fetch(`${baseUrl}/api/reviews/reply-all`, {
      method: "POST",
    });

    data = await res.json();

    steps.push({
      step: "Reply to Shopee",
      success: res.ok,
      result: data,
    });

    return NextResponse.json({
      success: true,
      workflow: steps,
    });

  } catch (err) {

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      {
        status: 500,
      }
    );

  }
}