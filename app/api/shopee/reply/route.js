import { NextResponse } from "next/server";
import { replyComment } from "../../../../src/services/shopee/ReplyService";

export const dynamic = 'force-dynamic';
export async function POST(request) {

  try {

    const body = await request.json();

    const result = await replyComment({

      shopId: body.shopId,

      accessToken: body.accessToken,

      commentId: body.commentId,

      reply: body.reply,

    });

    return NextResponse.json({

      success: true,

      result,

    });

  } catch (error) {

    return NextResponse.json({

      success: false,

      error: error.message,

    }, {

      status: 500,

    });

  }

}