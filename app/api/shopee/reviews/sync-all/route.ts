import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

const SHOP_IDS = [
  // OBERMAIN
  '115383763',
  '1637647671',
  '1747523033',
  '1747523036',

  // RAV DESIGN
  '469553987',
  '1770621264',
  '1770621266',
  '1770621271',

  // HUSH PUPPIES
  '282544493',

  // BEVERLY HILLS POLO CLUB
  '170811257',
  '74401016',
  '190669704',

  // JOHN LANGFORD
  '170808053',

  // NICOLE COLLECTION
  '66854646',
];

export async function POST(request) {
  const startedAt = Date.now();

  const baseUrl = new URL(request.url).origin;

  const results = [];

  for (const shopId of SHOP_IDS) {
    try {
      console.log(`[Sync All] Starting shop ${shopId}`);

      const response = await fetch(
        `${baseUrl}/api/shopee/reviews/sync?shopId=${shopId}`,
        {
          method: 'POST',
          cache: 'no-store',
        }
      );

      const data = await response.json();

      results.push({
        shopId,
        success:
          response.ok &&
          data?.success === true,

        brand:
          data?.brand || null,

        storeName:
          data?.storeName || null,

        syncedCount:
          Number(data?.syncedCount || 0),

        reviewsSeen:
          Number(data?.reviewsSeen || 0),

        skippedCount:
          Number(data?.skippedCount || 0),

        pagesProcessed:
          Number(data?.pagesProcessed || 0),

        error:
          data?.error || null,
      });

    } catch (error) {
      results.push({
        shopId,
        success: false,
        brand: null,
        storeName: null,
        syncedCount: 0,
        reviewsSeen: 0,
        skippedCount: 0,
        pagesProcessed: 0,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const successful =
    results.filter(
      (item) => item.success
    ).length;

  const failed =
    results.filter(
      (item) => !item.success
    ).length;

  const totalSynced =
    results.reduce(
      (sum, item) =>
        sum +
        Number(item.syncedCount || 0),
      0
    );

  return NextResponse.json(
    {
      success: failed === 0,

      shopsTotal:
        SHOP_IDS.length,

      successfulShops:
        successful,

      failedShops:
        failed,

      totalSynced,

      durationMs:
        Date.now() - startedAt,

      results,
    },
    {
      status: 200,
      headers: {
        'Cache-Control':
          'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    }
  );
}