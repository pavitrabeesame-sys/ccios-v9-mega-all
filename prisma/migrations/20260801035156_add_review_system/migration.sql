-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'GENERATED', 'APPROVED', 'REJECTED', 'REPLIED');

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "storeName" TEXT NOT NULL,
    "orderNumber" TEXT,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "customerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "reviewText" TEXT,
    "aiReply" TEXT,
    "finalReply" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyTemplate" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplyTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_reviewId_key" ON "Review"("reviewId");
