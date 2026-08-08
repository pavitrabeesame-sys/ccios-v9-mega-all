import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization')

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Find pending Shopee reviews
    const pending = await prisma.review.findMany({
      where: {
        status: 'PENDING',
        marketplace: 'SHOPEE'
      },
      take: 10,
      orderBy: {
        createdAt: 'asc'
      }
    })

    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending reviews found'
      })
    }

    // TODO:
    // for (const review of pending) {
    //   const aiReply = await generateAIReply(review)
    //   await postReplyToShopee(review, aiReply)
    //
    //   await prisma.review.update({
    //     where: { id: review.id },
    //     data: {
    //       aiReply,
    //       finalReply: aiReply,
    //       status: 'REPLIED',
    //       repliedAt: new Date()
    //     }
    //   })
    // }

    return NextResponse.json({
      success: true,
      processed: pending.length,
      message: `Found ${pending.length} pending reviews`
    })

  } catch (error) {
    console.error('Cron error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}