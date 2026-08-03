import { NextResponse } from "next/server";

// SAMPLE DATA — replace with a real customer query from your database/platform APIs.
const sampleCustomers = [
  { id: "CUST-001", name: "A. Rahman", orders: 4, lifetimeValue: 320.5, platform: "Shopee" },
  { id: "CUST-002", name: "S. Tan", orders: 1, lifetimeValue: 45.0, platform: "Lazada" },
];

export async function GET() {
  return NextResponse.json({
    _note: "Sample data. Replace with a real customer query in app/api/customers/route.js",
    data: sampleCustomers,
  });
}
