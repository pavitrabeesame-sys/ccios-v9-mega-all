const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {

  await prisma.review.deleteMany();

  await prisma.review.createMany({

    data: [

      {
        reviewId: "REV0001",
        marketplace: "SHOPEE",
        storeName: "ravdesign.os",
        orderNumber: "SP100001",
        productName: "RAV Leather Wallet",
        productSku: "RAV-WLT-001",
        customerName: "Ahmad",
        rating: 5,
        reviewText: "Barang sangat cantik dan kulit berkualiti.",
        status: "PENDING",
      },

      {
        reviewId: "REV0002",
        marketplace: "SHOPEE",
        storeName: "championmy.os",
        orderNumber: "SP100002",
        productName: "Champion Backpack",
        productSku: "CH-BAG-001",
        customerName: "Jason",
        rating: 5,
        reviewText: "Very good quality. Fast delivery.",
        status: "PENDING",
      },

      {
        reviewId: "REV0003",
        marketplace: "SHOPEE",
        storeName: "nicolecollection",
        orderNumber: "SP100003",
        productName: "Women's Blouse",
        productSku: "NC-BLS-001",
        customerName: "Siti",
        rating: 4,
        reviewText: "Baju cantik dan selesa dipakai.",
        status: "PENDING",
      }

    ]

  });

  console.log("✅ Seed completed.");

}

main()
.catch(console.error)
.finally(async()=>{

await prisma.$disconnect();

});