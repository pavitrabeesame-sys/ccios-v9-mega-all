"use client";

import { useState, useEffect } from 'react';

interface Review {
  id: string;
  reviewId?: string;
  marketplace: string;
  productName?: string;
  productSku?: string;
  customerName: string;
  rating: number;
  reviewText: string | null;
  aiReply: string | null;
  finalReply?: string | null;
  status: string;
  brand?: string | null;
}

export default function ReviewDashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [editableReply, setEditableReply] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch pending reviews on load
  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/reviews?status=PENDING');
      const data = await res.json();
      setReviews(data.reviews || []); // 👈 Ensure it unpacks the reviews array properly
    } catch (error) {
      console.error('Failed to load reviews:', error);
    }
  };

  const handleSelectReview = (review: Review) => {
    setSelectedReview(review);
    setEditableReply(review.aiReply || '');
  };

  const handleApprove = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    try {
      // 1. Update status and final reply locally in database
      const res = await fetch(`/api/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiReply: selectedReview?.aiReply || '',
          finalReply: editableReply,
          status: status,
          repliedBy: 'ADMIN'
        })
      });

      const data = await res.json();
      if (data.success) {
        // 2. If approved, trigger Shopee Marketplace Sync
        if (status === 'APPROVED') {
          try {
            await fetch(`/api/reviews/${id}/sync-shopee`, {
              method: 'POST'
            });
          } catch (syncError) {
            console.error('Shopee sync trigger failed:', syncError);
          }
        }

        setReviews(reviews.filter((r) => r.id !== id));
        setSelectedReview(null);
      }
    } catch (error) {
      console.error('Failed to update review status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 p-6 gap-6">
      {/* Left Column: Pending Reviews List */}
      <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-y-auto p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Pending Reviews</h2>
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              onClick={() => handleSelectReview(review)}
              className={`p-4 rounded-lg border cursor-pointer transition-all ${
                selectedReview?.id === review.id
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-sm text-gray-700">{review.customerName}</span>
                <span className="text-xs text-yellow-600 font-medium">★ {review.rating} / 5</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                {review.brand && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                    {review.brand}
                  </span>
                )}
                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium uppercase">
                  {review.marketplace}
                </span>
              </div>
              <p className="text-sm text-gray-600 truncate">{review.reviewText || 'No review text'}</p>
            </div>
          ))}
          {reviews.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No pending reviews found.</p>
          )}
        </div>
      </div>

      {/* Right Column: Review Detail & Approval Action Box */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
        {selectedReview ? (
          <div className="flex flex-col h-full">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Review Details</h2>
            
            <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-2">
              <div className="flex justify-between">
                <div className="text-sm text-gray-500">Customer: <span className="font-medium text-gray-800">{selectedReview.customerName}</span></div>
                <div className="text-sm text-gray-500">Marketplace: <span className="font-medium uppercase text-blue-600">{selectedReview.marketplace}</span></div>
              </div>
              <div className="flex justify-between">
                <div className="text-sm text-gray-500">Rating: <span className="font-medium text-yellow-600">★ {selectedReview.rating} / 5</span></div>
                {selectedReview.brand && (
                  <div className="text-sm text-gray-500">Brand: <span className="font-medium text-gray-800">{selectedReview.brand}</span></div>
                )}
              </div>
              {selectedReview.productName && (
                <div className="text-sm text-gray-500">Product: <span className="font-medium text-gray-800">{selectedReview.productName}</span></div>
              )}
              <div className="text-sm text-gray-500">Feedback: <span className="text-gray-800">{selectedReview.reviewText || 'No review text'}</span></div>
            </div>

            <div className="flex flex-col flex-1 space-y-2 mb-6">
              <label className="text-sm font-semibold text-gray-700">Final Reply (Editable):</label>
              <textarea
                value={editableReply}
                onChange={(e) => setEditableReply(e.target.value)}
                className="w-full flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                placeholder="Edit reply before approving..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => handleApprove(selectedReview.id, 'REJECTED')}
                disabled={loading}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedReview.id, 'APPROVED')}
                disabled={loading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Approve & Sync'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select a review from the left sidebar to inspect and approve.
          </div>
        )}
      </div>
    </div>
  );
}