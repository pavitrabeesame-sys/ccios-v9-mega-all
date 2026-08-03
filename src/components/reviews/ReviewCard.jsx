"use client";

import StatusBadge from "./StatusBadge";
import MarketplaceBadge from "./MarketplaceBadge";

export default function ReviewCard({ review }) {
  return (
    <div className="bg-white rounded-xl shadow p-5 border">

      <div className="flex justify-between mb-3">

        <div>
          <h3 className="font-semibold text-lg">
            {review.customerName}
          </h3>

          <p className="text-gray-500 text-sm">
            {review.productName}
          </p>
        </div>

        <MarketplaceBadge marketplace={review.marketplace} />

      </div>

      <div className="mb-3">
        {"⭐".repeat(review.rating)}
      </div>

      <p className="text-gray-700 mb-4">
        {review.reviewText}
      </p>

      {review.aiReply && (
        <div className="bg-slate-50 rounded-lg p-3 mb-4">
          <div className="text-xs font-semibold text-gray-500 mb-1">
            AI Reply
          </div>
          <div>{review.aiReply}</div>
        </div>
      )}

      <StatusBadge status={review.status} />

    </div>
  );
}