import { NextResponse } from "next/server";
import { runCCIOSCron } from "@/services/scheduler/CronManager";

export const dynamic = "force-dynamic";

export async function GET(request) {

  try {

    const auth = request.headers.get("authorization");

    if (process.env.CRON_SECRET) {

      if (auth !== `Bearer ${process.env.CRON_SECRET}`) {

        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized",
          },
          {
            status: 401,
          }
        );

      }

    }

    const result = await runCCIOSCron();

    return NextResponse.json({
      success: true,
      result,
      executedAt: new Date().toISOString(),
    });

  } catch (error) {

    console.error("========== CRON ERROR ==========");
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack:
          process.env.NODE_ENV === "development"
            ? error.stack
            : undefined,
      },
      {
        status: 500,
      }
    );

  }
}