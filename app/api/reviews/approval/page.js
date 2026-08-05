'use client';

import { useState, useEffect } from 'react';

export default function ReviewApprovalPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState('');

  // Fetch reviews on load
  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reviews');
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews || data); // Adjust based on your API response structure
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // Handle local text edits for a specific review's AI reply
  const handleReplyChange = (id, newText) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, aiReply: newText } : r))
    );
  };

  // Trigger bulk generation for empty reviews
  const handleGenerateAll = async () => {
    try {
      setMessage('Generating AI replies in queue...');
      const res = await fetch('/api/reviews/generate-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Successfully generated ${data.generated} replies!`);
        fetchReviews();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    }
  };

  // Save / Approve an individual review
  const handleSaveApproval = async (review) => {
    try {
      setProcessingId(review.id);
      const res = await fetch(`/api/reviews/${review.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiReply: review.aiReply,
          status: 'APPROVED', // or published flag depending on your schema
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`Review ID ${review.id} approved successfully!`);
        fetchReviews();
      }
    } catch (err) {
      console.error('Failed to save review:', err);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Review Approval Dashboard</h1>
            <p className="text-sm text-gray-600">Review, edit, and approve AI-generated customer service responses.</p>
          </div>
          <button
            onClick={handleGenerateAll}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Generate All Pending AI Replies ⚡
          </button>
        </div>

        {message && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
            No reviews found.
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="inline-block bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold mr-2">
                      ⭐ {review.rating} Stars
                    </span>
                    <span className="text-xs text-gray-500">Review ID: {review.id}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    {review.aiReply ? 'Ready for Review' : 'Pending Generation'}
                  </span>
                </div>

                {/* Original Review */}
                <div className="mb-4 bg-gray-50 p-3 rounded-lg text-sm text-gray-700">
                  <strong>Customer:</strong> {review.reviewText || 'No review text provided.'}
                </div>

                {/* Editable AI Reply Box */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                    AI Generated Reply (Editable)
                  </label>
                  <textarea
                    rows={4}
                    value={review.aiReply || ''}
                    onChange={(e) => handleReplyChange(review.id, e.target.value)}
                    placeholder="Click 'Generate All' or write a custom reply here..."
                    className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    disabled={processingId === review.id}
                    onClick={() => handleSaveApproval(review)}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {processingId === review.id ? 'Saving...' : 'Approve & Save ✓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}