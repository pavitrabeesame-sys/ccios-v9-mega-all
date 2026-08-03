import { NextResponse } from "next/server";

// SAMPLE DATA — replace with a real out-of-stock query from your inventory system.
const sampleOOS = [
  { sku: "RAV-MB-001-BLK", product: "Bifold Wallet MB-001 (Black)", brand: "RAV Design", stock: 0 },
  { sku: "NIC-CH-BEIGE", product: "Card Holder Minimalist Beige", brand: "Nicole Collection", stock: 0 },
];

export async function GET() {
  return NextResponse.json({
    _note: "Sample data. Replace with a real inventory query in app/api/oos/route.js",
    data: sampleOOS,
  });
}
