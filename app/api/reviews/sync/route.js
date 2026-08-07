import { NextResponse } from 'next/server';

if (!globalThis.mockReviewStore) {
  globalThis.mockReviewStore = [
    // Shopee Reviews
    { reviewId: 'shopee_nicole_1', marketplace: 'SHOPEE', brand: 'Nicole', productName: 'Nicole Classic Apparel', customerName: 'minniemouse_x', rating: 5, reviewText: 'Love the functional pockets :)', status: 'PENDING' },
    { reviewId: 'shopee_obermain_1', marketplace: 'SHOPEE', brand: 'Obermain', productName: 'Obermain Leather Wallet', customerName: 'wan_hadi90', rating: 5, reviewText: 'Super premium material!', status: 'PENDING' },
    { reviewId: 'shopee_hush_1', marketplace: 'SHOPEE', brand: 'Hush Puppies', productName: 'Hush Puppies Casual Belt', customerName: 'florawong1989', rating: 4, reviewText: 'Nice material and good fit.', status: 'PENDING' },
    { reviewId: 'shopee_rav_1', marketplace: 'SHOPEE', brand: 'RAV Design', productName: 'RAV Classic Shirt', customerName: 'kentsean299', rating: 5, reviewText: 'Good quality.', status: 'PENDING' },
    { reviewId: 'shopee_bhpc_1', marketplace: 'SHOPEE', brand: 'Beverly Hills Polo Club', productName: 'BHPC Polo Tee', customerName: 'hanapi_1987', rating: 5, reviewText: 'Very comfortable.', status: 'PENDING' },

    // Lazada Reviews (Preserved for when approval is finalized)
    { reviewId: 'lazada_nicole_1', marketplace: 'LAZADA', brand: 'Nicole', productName: 'Nicole Lazada Dress', customerName: 'siti_zulaikha', rating: 5, reviewText: 'Cantik sangat baju ni!', status: 'PENDING' },
    { reviewId: 'lazada_obermain_1', marketplace: 'LAZADA', brand: 'Obermain', productName: 'Obermain Sling Bag', customerName: 'ahmed_99', rating: 4, reviewText: 'Fast delivery from Lazada.', status: 'PENDING' },
    { reviewId: 'lazada_hush_1', marketplace: 'LAZADA', brand: 'Hush Puppies', productName: 'Hush Puppies Wallet', customerName: 'chong_lee', rating: 5, reviewText: 'Original product, happy buyer.', status: 'PENDING' },
    { reviewId: 'lazada_rav_1', marketplace: 'LAZADA', brand: 'RAV Design', productName: 'RAV Design Trousers', customerName: 'wanmohdmai', rating: 5, reviewText: 'Barang baik boss', status: 'PENDING' },
    { reviewId: 'lazada_bhpc_1', marketplace: 'LAZADA', brand: 'Beverly Hills Polo Club', productName: 'BHPC Jacket', customerName: 'maialysa', rating: 4, reviewText: 'Nice material and good fit.', status: 'PENDING' }
  ];
}

// Exponential backoff helper ready for live Lazada API calls post-approval
async function fetchLazadaWithBackoff(url, options = {}, retries = 3, delay = 1000) {
  try {
    const response = await fetch(url, options);
    if (response.status === 429 || response.status >= 500) {
      if (retries > 0) {
        console.warn(`Lazada API backed off (Status ${response.status}). Retrying in ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        return fetchLazadaWithBackoff(url, options, retries - 1, delay * 2);
      }
    }
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Lazada network error, retrying in ${delay}ms...`, err.message);
      await new Promise(res => setTimeout(res, delay));
      return fetchLazadaWithBackoff(url, options, retries - 1, delay * 2);
    }
    throw err;
  }
}

export async function POST(request) {
  try {
    let liveReviews = globalThis.mockReviewStore;

    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      for (const rev of liveReviews) {
        await prisma.review.upsert({
          where: { reviewId: rev.reviewId },
          update: { 
            reviewText: rev.reviewText, 
            rating: rev.rating, 
            productName: rev.productName, 
            marketplace: rev.marketplace, 
            brand: rev.brand 
          },
          create: rev,
        });
      }
    } catch (dbErr) {
      console.log('Using memory store sync fallback:', dbErr.message);
    }

    const shopeeCount = liveReviews.filter(r => r.marketplace === 'SHOPEE').length;
    const lazadaCount = liveReviews.filter(r => r.marketplace === 'LAZADA').length;

    return NextResponse.json({
      success: true,
      syncedCount: liveReviews.length,
      breakdown: { 
        shopee: shopeeCount, 
        lazada: lazadaCount 
      }
    });
  } catch (error) {
    console.error('Review Sync API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}