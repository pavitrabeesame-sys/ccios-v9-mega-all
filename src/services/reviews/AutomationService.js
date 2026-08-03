export function shouldAutoReply(review) {

  if (review.rating >= 4) return true;

  return false;

}

export function requiresManualReview(review) {

  return review.rating <= 3;

}

export function getNextStatus(review) {

  if (review.rating >= 4) return "GENERATED";

  return "PENDING";

}