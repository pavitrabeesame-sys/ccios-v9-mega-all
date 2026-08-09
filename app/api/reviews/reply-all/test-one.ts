// Test script for a single review reply post to Shopee
import { prisma } from '@/lib/prisma';

async function testSingleReply() {
  const review = await prisma.review.findFirst({
    where: { marketplace: 'SHOPEE', aiReply: { not: null }, status: { not: 'REPLIED' } }
  });

  if (!review) {
    console.log('No eligible Shopee review found for testing.');
    return;
  }

  console.log(`Testing reply-all route with review ID: ${review.id} (Review ID: ${review.reviewId})`);

  const response = await fetch('http://localhost:3000/api/reviews/reply-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: [review.id] }),
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

testSingleReply()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
