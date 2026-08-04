import {
  AUTO_APPROVE_STARS,
  MANUAL_KEYWORDS,
  MIN_CONFIDENCE,
} from "./rules";

export function approvalEngine({
  rating = 5,
  review = "",
  confidence = 1,
  sentiment = "POSITIVE",
}) {
  const text = review.toLowerCase();

  // Low AI confidence
  if (confidence < MIN_CONFIDENCE) {
    return "MANUAL_REVIEW";
  }

  // Complaint keywords
  if (MANUAL_KEYWORDS.some(word => text.includes(word))) {
    return "MANUAL_REVIEW";
  }

  // Negative sentiment
  if (sentiment === "NEGATIVE") {
    return "MANUAL_REVIEW";
  }

  // 4★–5★
  if (AUTO_APPROVE_STARS.includes(Number(rating))) {
    return "AUTO_APPROVED";
  }

  // 1★–3★
  return "MANUAL_REVIEW";
}

export default approvalEngine;