import { NextResponse } from 'next/server';

if (!globalThis.mockReviewStore) {
  globalThis.mockReviewStore = [
    // Shopee Reviews
    { reviewId: 'shopee_nicole_1', marketplace: 'SHOPEE', brand: 'Nicole', productName: 'Nicole Classic Apparel', storeName: 'Nicole Flagship Store', customerName: 'minniemouse_x', rating: 5, reviewText: 'Love the functional pockets :)', status: 'PENDING' },
    { reviewId: 'shopee_obermain_1', marketplace: 'SHOPEE', brand: 'Obermain', productName: 'Obermain Leather Wallet', storeName: 'Obermain Official Store', customerName: 'wan_hadi90', rating: 5, reviewText: 'Super premium material!', status: 'PENDING' },
    { reviewId: 'shopee_hush_1', marketplace: 'SHOPEE', brand: 'Hush Puppies', productName: 'Hush Puppies Casual Belt', storeName: 'Hush Puppies Store', customerName: 'florawong1989', rating: 4, reviewText: 'Nice material and good fit.', status: 'PENDING' },
    { reviewId: 'shopee_rav_1', marketplace: 'SHOPEE', brand: 'RAV Design', productName: 'RAV Classic Shirt', storeName: 'RAV Design Store', customerName: 'kentsean299', rating: 5, reviewText: 'Good quality.', status: 'PENDING' },
    { reviewId: 'shopee_bhpc_1', marketplace: 'SHOPEE', brand: 'Beverly Hills Polo Club', productName: 'BHPC Polo Tee', storeName: 'BHPC Official Store', customerName: 'hanapi_1987', rating: 5, reviewText: 'Very comfortable.', status: 'PENDING' },

    // Lazada Reviews
    { reviewId: 'lazada_nicole_1', marketplace: 'LAZADA', brand: 'Nicole', productName: 'Nicole Lazada Dress', storeName: 'Nicole Lazada Store', customerName: 'siti_zulaikha', rating: 5, reviewText: 'Cantik sangat baju ni!', status: 'PENDING' },
    { reviewId: 'lazada_obermain_1', marketplace: 'LAZADA', brand: 'Obermain', productName: 'Obermain Sling Bag', storeName: 'Obermain Lazada Store', customerName: 'ahmed_99', rating: 4, reviewText: 'Fast delivery from Lazada.', status: 'PENDING' },
    { reviewId: 'lazada_hush_1', marketplace: 'LAZADA', brand: 'Hush Puppies', productName: 'Hush Puppies Wallet', storeName: 'Hush Puppies Lazada Store', customerName: 'chong_lee', rating: 5, reviewText: 'Original product, happy buyer.', status: 'PENDING' },
    { reviewId: 'lazada_rav_1', marketplace: 'LAZADA', brand: 'RAV Design', productName: 'RAV Design Trousers', storeName: 'RAV Design Lazada Store', customerName: 'wanmohdmai', rating: 5, reviewText: 'Barang baik boss', status: 'PENDING' },
    { reviewId: 'lazada_bhpc_1', marketplace: 'LAZADA', brand: 'Beverly Hills Polo Club', productName: 'BHPC Jacket', storeName: 'BHPC Lazada Store', customerName: 'maialysa', rating: 4, reviewText: 'Nice material and good fit.', status: 'PENDING' }
  ];
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
            brand: rev.brand,
            storeName: rev.storeName || `${rev.brand} Official Store`
          },
          create: {
            ...rev,
            storeName: rev.storeName || `${rev.brand} Official Store`
          },
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