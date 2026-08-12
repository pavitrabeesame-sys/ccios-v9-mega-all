'use client';

import { useState, useEffect, useCallback } from 'react';

export default function ReviewApprovalPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // ============================================================
  // FETCH REVIEWS
  // ============================================================

  const fetchReviews = useCallback(async () => {
    try {
      setError('');

      const res = await fetch('/api/reviews', {
        method: 'GET',
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || `Failed to fetch reviews (${res.status})`
        );
      }

      // API may return:
      // 1. direct array
      // 2. { reviews: [...] }
      // 3. { data: [...] }

      let reviewList = [];

      if (Array.isArray(data)) {
        reviewList = data;
      } else if (Array.isArray(data?.reviews)) {
        reviewList = data.reviews;
      } else if (Array.isArray(data?.data)) {
        reviewList = data.data;
      }

      setReviews(reviewList);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to fetch reviews'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // ============================================================
  // REVIEW STATUS
  //
  // IMPORTANT:
  //
  // PENDING + aiReply
  //     = READY FOR REVIEW
  //
  // PENDING + no aiReply
  //     = PENDING GENERATION
  //
  // APPROVED
  //     = APPROVED
  // ============================================================

  const getReviewStatus = (review) => {
    const status = String(review?.status || '').toUpperCase();

    const hasAiReply =
      typeof review?.aiReply === 'string' &&
      review.aiReply.trim().length > 0;

    if (status === 'APPROVED') {
      return 'APPROVED';
    }

    if (status === 'REPLIED' || status === 'PUBLISHED') {
      return 'PUBLISHED';
    }

    if (hasAiReply) {
      return 'READY FOR REVIEW';
    }

    return 'NOT GENERATED';
  };

  // ============================================================
  // STATUS STYLE
  // ============================================================

  const getStatusClass = (review) => {
    const status = getReviewStatus(review);

    if (status === 'APPROVED') {
      return 'bg-emerald-100 text-emerald-700';
    }

    if (status === 'PUBLISHED') {
      return 'bg-purple-100 text-purple-700';
    }

    if (status === 'READY FOR REVIEW') {
      return 'bg-blue-100 text-blue-700';
    }

    return 'bg-amber-100 text-amber-700';
  };

  // ============================================================
  // EDIT AI REPLY
  // ============================================================

  const handleReplyChange = (id, newText) => {
    setReviews((prev) =>
      prev.map((review) =>
        review.id === id
          ? {
              ...review,
              aiReply: newText,
            }
          : review
      )
    );
  };

  // ============================================================
  // GENERATE ALL
  // ============================================================

  const handleGenerateAll = async () => {
    if (generating) return;

    try {
      setGenerating(true);
      setMessage('');
      setError('');

      const res = await fetch('/api/reviews/generate-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error || `Generation failed (${res.status})`
        );
      }

      const generated =
        typeof data?.generated === 'number'
          ? data.generated
          : 0;

      setMessage(
        `Successfully generated ${generated} AI repl${
          generated === 1 ? 'y' : 'ies'
        }. Refreshing reviews...`
      );

      // Give DB update a moment
      await new Promise((resolve) =>
        setTimeout(resolve, 500)
      );

      // IMPORTANT:
      // Fetch fresh database data.
      await fetchReviews();

      setMessage(
        `Successfully generated ${generated} AI repl${
          generated === 1 ? 'y' : 'ies'
        }. Generated reviews are now READY FOR REVIEW.`
      );
    } catch (err) {
      console.error('Generate all failed:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate AI replies'
      );
    } finally {
      setGenerating(false);
    }
  };

  // ============================================================
  // APPROVE / SAVE
  // ============================================================

  const handleSaveApproval = async (review) => {
    const reply = String(review?.aiReply || '').trim();

    if (!reply) {
      setError(
        'This review does not have an AI reply yet.'
      );
      return;
    }

    try {
      setProcessingId(review.id);
      setMessage('');
      setError('');

      const res = await fetch(
        `/api/reviews/${review.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          body: JSON.stringify({
            aiReply: reply,
            finalReply: reply,
            status: 'APPROVED',
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            `Failed to approve review (${res.status})`
        );
      }

      setMessage(
        `Review ${
          review.reviewId || review.id
        } approved successfully.`
      );

      await fetchReviews();
    } catch (err) {
      console.error(
        'Failed to save review:',
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : 'Failed to approve review'
      );
    } finally {
      setProcessingId(null);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
            Loading reviews...
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* HEADER */}

        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">

          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              AI Review Approval Dashboard
            </h1>

            <p className="text-sm text-gray-600 mt-1">
              Review, edit, and approve AI-generated
              customer service responses.
            </p>
          </div>

          <div className="flex gap-2">

            <button
              onClick={fetchReviews}
              disabled={generating}
              className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition disabled:opacity-50"
            >
              ↻ Refresh
            </button>

            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {generating
                ? 'Generating...'
                : 'Generate All Pending AI Replies ⚡'}
            </button>

          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* MESSAGE */}

        {message && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* REVIEWS */}

        {reviews.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            No reviews found.
          </div>
        ) : (
          <div className="space-y-4">

            {reviews.map((review) => {

              const status =
                getReviewStatus(review);

              const hasAiReply =
                typeof review.aiReply === 'string' &&
                review.aiReply.trim().length > 0;

              const isProcessing =
                processingId === review.id;

              return (
                <div
                  key={review.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
                >

                  {/* TOP */}

                  <div className="flex justify-between items-start mb-4">

                    <div>

                      <div className="flex flex-wrap gap-2">

                        <span className="inline-block bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold">
                          ⭐ {review.rating ?? '-'} Stars
                        </span>

                        {review.brand && (
                          <span className="inline-block bg-purple-100 text-purple-700 text-xs px-2.5 py-1 rounded-full font-semibold">
                            {review.brand}
                          </span>
                        )}

                      </div>

                      <div className="text-xs text-gray-500 mt-2">
                        Review ID:{' '}
                        {review.reviewId ||
                          review.id}
                      </div>

                    </div>

                    {/* STATUS */}

                    <span
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full ${getStatusClass(
                        review
                      )}`}
                    >
                      {status}
                    </span>

                  </div>

                  {/* CUSTOMER REVIEW */}

                  <div className="mb-4">

                    <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
                      Customer Review
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                      {review.reviewText ||
                        'No review text provided.'}
                    </div>

                  </div>

                  {/* AI REPLY */}

                  <div className="mb-4">

                    <div className="flex justify-between items-center mb-2">

                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        AI Generated Reply
                      </label>

                      {hasAiReply && (
                        <span className="text-xs font-semibold text-blue-600">
                          ✓ AI GENERATED
                        </span>
                      )}

                    </div>

                    <textarea
                      rows={5}
                      value={
                        review.aiReply || ''
                      }
                      onChange={(e) =>
                        handleReplyChange(
                          review.id,
                          e.target.value
                        )
                      }
                      placeholder={
                        hasAiReply
                          ? ''
                          : 'Click Generate All to create an AI reply...'
                      }
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />

                  </div>

                  {/* ACTIONS */}

                  <div className="flex justify-between items-center gap-3">

                    <div className="text-xs text-gray-500">

                      {hasAiReply
                        ? 'AI reply generated. Review and edit before approval.'
                        : 'No AI reply generated yet.'}

                    </div>

                    <button
                      disabled={
                        isProcessing ||
                        !hasAiReply
                      }
                      onClick={() =>
                        handleSaveApproval(
                          review
                        )
                      }
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing
                        ? 'Saving...'
                        : 'Approve & Save ✓'}
                    </button>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>
    </div>
  );
}