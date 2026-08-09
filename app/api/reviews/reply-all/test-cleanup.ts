// Quick cleanup script to reset the test review status if needed
import { prisma } from '@/lib/prisma';

async function resetTestReview() {
  const updated = await prisma.review.updateMany({
    where: { reviewId: '8864265012' },
    data: { status: 'PENDING', repliedAt: null, finalReply: null }
  });
  console.log('Reset test review status:', updated);
}

resetTestReview()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
