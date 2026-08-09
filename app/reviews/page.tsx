'use client';

import React, { useEffect, useState } from 'react';

export interface Review {
  id: string;
  reviewId?: string;
  userName?: string;
  comment?: string;
  aiReply?: string;
  finalReply?: string;
  rating?: number;
  status?: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/reviews');
      if (!res.ok) {
        throw new Error(`Failed to fetch reviews (Status: ${res.status})`);
      }
      const data = await res.json();
      
      // Ensure data is an array before setting state
      if (Array.isArray(data)) {
        setReviews(data);
      } else if (data && Array.isArray(data.reviews)) {
        setReviews(data.reviews);
      } else if (data && Array.isArray(data.data)) {
        setReviews(data.data);
      } else {
        setReviews([]);
      }
    } catch (err: any) {
      console.error('Error loading reviews:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Product Reviews Management</h1>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading reviews...</span>
        </div>
      )}

      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={fetchReviews}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div className="text-center py-12 bg-gray-50 border rounded-lg text-gray-500">
          No reviews found.
        </div>
      )}

      {!loading && !error && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review) =>
            review && review.id ? (
              <ReviewCard
                key={review.id}
                review={review}
                onReplySuccess={fetchReviews}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  onReplySuccess,
}: {
  review: any;
  onReplySuccess: () => void;
}) {
  const customerName = review?.customerName || 'Anonymous Customer';
  const commentText = review?.reviewText || 'No comment provided.';
  const initialReply = review?.finalReply || review?.aiReply || '';

  const [replyText, setReplyText] = useState<string>(initialReply);
  const [submitting, setSubmitting] = useState<boolean>(false);

  if (!review) return null;

  const handleApproveAndReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/reviews/${review.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customReply: replyText,
          approvedBy: 'CS Team',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to post reply');
      }

      onReplySuccess();
    } catch (err) {
      console.error('Error submitting reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-5 shadow-sm bg-white mb-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold text-gray-800">{customerName}</h3>
        <span className="text-sm font-medium text-amber-500">
          ★ {review?.rating ?? 5}/5
        </span>
      </div>

      <p className="text-gray-700 mb-4">{commentText}</p>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Reply
        </label>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-md p-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter reply text..."
        />
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={handleApproveAndReply}
          disabled={submitting || !replyText.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting...' : 'Approve & Reply'}
        </button>
      </div>
    </div>
  );
}