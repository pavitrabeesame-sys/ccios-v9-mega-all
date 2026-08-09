import { prisma } from '../../lib/prisma.js';
import { generateSmartAIReply } from './replyService.js';
// Import your Shopee client / item helper
import { getItemBaseInfo } from '../shopee/shopeeService.js';

/**
 * Resolves item name, variation model name, and main image.
 * Order of resolution:
 * 1. Raw item name in review payload
 * 2. Local database search by SKU or Shopee Item ID
 * 3. Live Shopee Open API v2 lookup (/api/v2/product/get_item_base_info)
 * 4. Fallback string
 */
export async function resolveShopeeProductDetails(rawItem, shopId) {
  let finalProductName = rawItem.itemName || rawItem.productName || '';
  let finalModelName = rawItem.modelName || rawItem.model_name || '';
  let finalProductImage = rawItem.productImage || '';
  const itemIdStr = String(rawItem.itemId || rawItem.item_id || '');
  const skuStr = rawItem.itemSku || rawItem.item_sku || rawItem.sku || '';

  // Step 1: Check Local Product & Variation Tables
  if (skuStr || itemIdStr) {
    const variation = await prisma.productVariation.findFirst({
      where: {
        OR: [
          { sku: skuStr },
          { externalId: itemIdStr }
        ]
      },
      include: { product: true }
    });

    if (variation) {
      return {
        productName: variation.product.name,
        modelName: finalModelName || variation.name,
        productImage: variation.product.image || finalProductImage,
        productSku: variation.sku
      };
    }

    const localProduct = await prisma.product.findFirst({
      where: {
        OR: [
          { shopeeItemId: itemIdStr },
          { sku: skuStr }
        ]
      }
    });

    if (localProduct && localProduct.name) {
      return {
        productName: localProduct.name,
        modelName: finalModelName,
        productImage: localProduct.image || finalProductImage,
        productSku: localProduct.sku || skuStr
      };
    }
  }

  // Step 2: Fetch Live Item Info from Shopee Open API
  if (!finalProductName && itemIdStr && itemIdStr !== 'undefined') {
    try {
      const shopeeItem = await getItemBaseInfo(itemIdStr, shopId);
      if (shopeeItem && shopeeItem.item_name) {
        finalProductName = shopeeItem.item_name;
        if (shopeeItem.image && shopeeItem.image.image_url_list && shopeeItem.image.image_url_list.length > 0) {
          finalProductImage = shopeeItem.image.image_url_list[0];
        }
      }
    } catch (err) {
      console.error(`[Shopee API Error] Failed to fetch item info for itemId ${itemIdStr}:`, err.message);
    }
  }

  // Step 3: Clean & Fallback
  if (!finalProductName || finalProductName.trim() === '') {
    finalProductName = `Shopee Product ${itemIdStr}`;
  }

  return {
    productName: finalProductName,
    modelName: finalModelName,
    productImage: finalProductImage,
    productSku: skuStr
  };
}

/**
 * Main review processor
 */
export async function processAndSaveShopeeReview(rawReview, storeName, brandName, shopId) {
  const commentId = String(rawReview.reviewId || rawReview.comment_id);

  // 1. Duplicate Check
  const existing = await prisma.review.findUnique({
    where: { reviewId: commentId }
  });
  if (existing) {
    return existing;
  }

  // 2. Resolve Product Metadata
  const productDetails = await resolveShopeeProductDetails(rawReview, shopId);

  // 3. Shopee Review Creation Timestamp Conversion
  const reviewDate = rawReview.create_time
    ? new Date(rawReview.create_time * 1000)
    : (rawReview.createdAt ? new Date(rawReview.createdAt) : new Date());

  // 4. Generate AI Reply and Intelligence Metadata
  const aiResult = await generateSmartAIReply({
    customerName: rawReview.buyer_username || rawReview.customerName || 'Valued Customer',
    rating: rawReview.rating_star || rawReview.rating || 5,
    reviewText: rawReview.comment || rawReview.reviewText || '',
    productName: productDetails.productName,
    modelName: productDetails.modelName,
    brandName: brandName
  });

  // 5. Save Record
  const savedReview = await prisma.review.create({
    data: {
      reviewId: commentId,
      marketplace: 'SHOPEE',
      storeName: storeName,
      brand: brandName,
      orderNumber: rawReview.order_sn || rawReview.orderNumber || null,
      productSku: productDetails.productSku || null,
      productName: productDetails.productName,
      modelName: productDetails.modelName || null,
      productImage: productDetails.productImage || null,
      customerName: rawReview.buyer_username || rawReview.customerName || 'Valued Customer',
      rating: rawReview.rating_star || rawReview.rating || 5,
      reviewText: rawReview.comment || rawReview.reviewText || '',
      imageUrls: rawReview.images || rawReview.imageUrls || [],
      videoUrls: rawReview.videos || rawReview.videoUrls || [],
      createdAt: reviewDate,
      syncTime: new Date(),

      // AI Intelligence
      aiReply: aiResult.reply,
      sentiment: aiResult.sentiment,
      emotion: aiResult.emotion,
      confidence: aiResult.confidence,
      language: aiResult.language,
      keywords: aiResult.keywords,
      status: aiResult.isSpam ? 'PENDING' : 'GENERATED'
    }
  });

  console.log(`[Sync Success] Review ${commentId} saved with Product: "${productDetails.productName}"`);
  return savedReview;
}