import { NextResponse } from "next/server";

export async function GET() {

  return NextResponse.json({

    insights: [

      "Positive reviews increasing",

      "Negative reviews stable",

      "Chinese reviews increasing",

      "Auto approval rate improving",

      "Average rating above 4.8★"

    ]

  });

}