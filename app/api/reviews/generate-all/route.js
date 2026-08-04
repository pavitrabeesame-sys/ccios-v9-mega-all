import { NextResponse } from "next/server";
import generateAllReplies from "@/src/ai/reply/generateAll";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const results = await generateAllReplies();

    return NextResponse.json({
      success: true,
      total: results.length,
      results,
    });

  } catch (err) {

    console.error(err);

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