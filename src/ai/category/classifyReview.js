// src/ai/category/classifyReview.js

const CATEGORY_RULES = {

  "PRODUCT_QUALITY": [
    "quality",
    "bagus",
    "baik",
    "material",
    "leather",
    "genuine",
    "original",
    "authentic",
    "品质",
    "质量"
  ],

  "DELIVERY": [
    "delivery",
    "shipping",
    "courier",
    "arrived",
    "late",
    "fast",
    "slow",
    "lambat",
    "cepat",
    "送货"
  ],

  "PACKAGING": [
    "package",
    "packaging",
    "box",
    "bubble",
    "wrap",
    "parcel",
    "包装"
  ],

  "SIZE": [
    "size",
    "fit",
    "besar",
    "kecil",
    "too big",
    "too small",
    "尺寸"
  ],

  "COLOR": [
    "color",
    "colour",
    "black",
    "brown",
    "warna",
    "颜色"
  ],

  "PRICE": [
    "cheap",
    "expensive",
    "price",
    "worth",
    "value",
    "murah",
    "mahal",
    "价格"
  ],

  "CUSTOMER_SERVICE": [
    "seller",
    "service",
    "support",
    "help",
    "customer service"
  ],

  "DAMAGED": [
    "broken",
    "damage",
    "damaged",
    "rosak",
    "defect",
    "裂"
  ],

};

export function classifyReview(text = "") {

  const review = text.toLowerCase();

  for (const category of Object.keys(CATEGORY_RULES)) {

    for (const keyword of CATEGORY_RULES[category]) {

      if (review.includes(keyword.toLowerCase())) {

        return category;

      }

    }

  }

  return "GENERAL";

}

export default classifyReview;