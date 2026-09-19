import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    console.log("RAW SHOPEE WEBHOOK BODY:", rawBody);

    let body;

    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("INVALID SHOPEE WEBHOOK JSON:", parseError);
      return NextResponse.json({ success: false, error: "Invalid JSON webhook payload" }, { status: 400 });
    }

    console.log("Received Shopee Webhook Payload:", JSON.stringify(body));

    const { code, shop_id, data } = body;

    if ((code === 3 || code === 4) && shop_id) {
      const orderSn = data?.order_sn;
      const orderStatus = data?.status;
      const trackingNo = data?.tracking_no;
      
      let buyerId = Number(data?.buyer_id ?? data?.userid ?? data?.customer_id ?? 0);

      if (!orderSn) {
        console.error(`Cannot send proactive chat: missing order_sn for shop ${shop_id}`);
        return NextResponse.json({ success: true });
      }

      console.log("PROACTIVE CHAT DATA:", {
        shopId: shop_id,
        orderSn,
        buyerId,
        orderStatus,
        trackingNo,
      });

      if (orderStatus === 'SHIPPED' || trackingNo) {
        try {
          const shopeeAccount = await prisma.shopeeAccount.findUnique({
            where: { shopId: BigInt(shop_id) },
            include: { brand: true },
          });

          const accessToken = shopeeAccount?.accessToken;

          if (shopeeAccount && accessToken) {
            const partnerId = Number(process.env.SHOPEE_PARTNER_ID);
            const partnerKey = process.env.SHOPEE_PARTNER_KEY || '';
            const timestamp = Math.floor(Date.now() / 1000);

            if (!buyerId || buyerId === 0) {
              console.log(`buyer_id is 0. Fetching order details for ${orderSn} from Shopee API...`);
              
              const detailPath = '/api/v2/order/get_order_detail';
              const detailBaseString = `${partnerId}${detailPath}${timestamp}${accessToken}${shop_id}`;
              const detailSign = crypto.createHmac('sha256', partnerKey).update(detailBaseString).digest('hex');

              const detailUrl = `https://partner.shopeemobile.com${detailPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shop_id}&sign=${detailSign}&order_sn_list=${encodeURIComponent(orderSn)}&response_optional_fields=buyer_user_id,item_list,package_list,order_status`;

              const orderRes = await fetch(detailUrl);
              const orderText = await orderRes.text();
              
              try {
                const orderData = JSON.parse(orderText);
                console.log("SHOPEE ORDER DETAIL:", JSON.stringify(orderData, null, 2));
                buyerId = Number(orderData?.response?.order_list?.[0]?.buyer_user_id || 0);
              } catch (e) {
                console.error("Failed to parse get_order_detail response:", orderText);
              }
              
              console.log(`Resolved buyer_id from Shopee API: ${buyerId}`);
            }

            if (buyerId > 0) {
              const chatPath = '/api/v2/sellerchat/send_message';
              const chatBaseString = `${partnerId}${chatPath}${timestamp}${accessToken}${shop_id}`;
              const chatSign = crypto.createHmac('sha256', partnerKey).update(chatBaseString).digest('hex');

              const chatUrl = `https://partner.shopeemobile.com${chatPath}?partner_id=${partnerId}&timestamp=${timestamp}&access_token=${accessToken}&shop_id=${shop_id}&sign=${chatSign}`;

              // Step 1: Send the mandatory order card to initialize the conversation and bypass first-chat restrictions
              const orderCardPayload = {
                to_id: buyerId,
                message_type: 'order',
                content: {
                  order_sn: orderSn,
                },
              };

              console.log("SHOPEE ORDER CARD REQUEST:", JSON.stringify(orderCardPayload, null, 2));

              const orderCardRes = await fetch(chatUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderCardPayload),
              });

              console.log("SHOPEE ORDER CARD RESPONSE:", await orderCardRes.text());

              // Step 2: Send the actual tracking update text message
              const messageText = `Hi there! Great news—your order (${orderSn}) has been packed and handed over to our courier partner. Tracking No: ${trackingNo}. Thank you for shopping with us!`;

              const chatPayload = {
                to_id: buyerId,
                message_type: 'text',
                content: {
                  text: messageText,
                },
              };

              console.log("SHOPEE CHAT REQUEST:", JSON.stringify(chatPayload, null, 2));

              const chatResponse = await fetch(chatUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatPayload),
              });

              const chatText = await chatResponse.text();
              console.log("SHOPEE CHAT HTTP STATUS:", chatResponse.status);
              console.log("SHOPEE CHAT RAW RESPONSE:", chatText);

              try {
                const chatResult = JSON.parse(chatText);
                if (chatResult?.error) {
                  console.error("SHOPEE CHAT API ERROR:", chatResult);
                } else {
                  console.log(`Proactive chat SUCCESS for order ${orderSn}:`, chatResult);
                }
              } catch (e) {
                console.error("Failed to parse send_message response:", chatText);
              }
            } else {
              console.log(`Skipped chat dispatch: Could not resolve a valid buyer_id for order ${orderSn}.`);
            }
          } else {
            console.log(`Skipped chat dispatch: ShopeeAccount not found or missing token.`);
          }
        } catch (dbError) {
          console.error('API query or chat dispatch failed internally:', dbError);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Shopee proactive webhook fatal error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}