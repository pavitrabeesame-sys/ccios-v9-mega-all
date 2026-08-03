"use client";

import ReplyEditor from "./ReplyEditor";
import StatusBadge from "./StatusBadge";

export default function ReviewModal({
  review,
  open,
  onClose,
  onReplyChange,
}) {

  if (!open || !review) return null;

  return (

    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

      <div className="bg-white rounded-xl w-[800px] max-h-[90vh] overflow-auto p-6">

        <div className="flex justify-between items-center mb-5">

          <h2 className="text-2xl font-bold">
            Review Details
          </h2>

          <button
            onClick={onClose}
            className="text-2xl"
          >
            ×
          </button>

        </div>

        <div className="space-y-3">

          <p><b>Customer:</b> {review.customerName}</p>

          <p><b>Product:</b> {review.productName}</p>

          <p><b>Marketplace:</b> {review.marketplace}</p>

          <p><b>Rating:</b> {"⭐".repeat(review.rating)}</p>

          <StatusBadge status={review.status} />

          <div className="bg-gray-100 p-4 rounded-lg">
            {review.reviewText}
          </div>

          <ReplyEditor
            value={review.aiReply}
            onChange={onReplyChange}
          />

        </div>

      </div>

    </div>

  );

}