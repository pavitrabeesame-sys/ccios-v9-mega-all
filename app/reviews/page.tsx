'use client';

import React, { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

interface Review {
  id: string;
  reviewId: string;
  productName: string | null;
  customerName: string;
  storeName: string;
  rating: number;
  reviewText: string | null;
  status: string;
  marketplace: string;
  brand: string | null;
  aiReply: string | null;
}

const BATCH_SIZE = 15;

type ReplyFilter =
  | 'NOT_GENERATED'
  | 'GENERATED'
  | 'REPLIED'
  | 'ALL';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState('');

  // FIX: store only the selected ID.
  // The actual selected review is always read from fresh `reviews`.
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('ALL');
  const [activeMarketplace, setActiveMarketplace] = useState('All');
  const [activeStars, setActiveStars] = useState<number[]>([]);
  const [replyFilter, setReplyFilter] =
    useState<ReplyFilter>('NOT_GENERATED');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  // =========================================================
  // SELECTED REVIEW
  // Always derived from the latest reviews state.
  // This fixes the NOVA panel not showing a newly generated reply.
  // =========================================================

  const selectedReview = useMemo(
    () =>
      selectedReviewId
        ? reviews.find((review) => review.id === selectedReviewId) || null
        : null,
    [reviews, selectedReviewId]
  );

  // =========================================================
  // LOAD REVIEWS
  // =========================================================

  const loadReviews = async () => {
    try {
      const res = await fetch('/api/reviews', {
        cache: 'no-store',
      });

      const data = await res.json();

      if (!Array.isArray(data)) {
        console.error('Unexpected reviews API response:', data);
        return;
      }

      setReviews(data);

      // Preserve selected review if it still exists.
      setSelectedReviewId((currentId) => {
        if (currentId && data.some((review: Review) => review.id === currentId)) {
          return currentId;
        }

        // Only choose first review when nothing is selected.
        if (!currentId && data.length > 0) {
          return data[0].id;
        }

        return null;
      });

      // Remove IDs that no longer exist.
      const validIds = new Set(
        data.map((review: Review) => review.id)
      );

      setSelectedIds((previous) =>
        previous.filter((id) => validIds.has(id))
      );
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  // =========================================================
  // SYNC SHOPEE
  // =========================================================

  // =========================================================
// SMART SYNC — SHOPEE + LAZADA
// =========================================================

const handleSync = async () => {
  setSyncing(true);
  setSyncProgress('Starting Smart Sync — Shopee + Lazada...');

  try {
    const res = await fetch('/api/reviews/smart-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(
        data?.error ||
          data?.message ||
          'Smart Sync failed.'
      );
    }

    const shopeeCount = Number(
      data?.breakdown?.shopee || 0
    );

    const lazadaCount = Number(
      data?.breakdown?.lazada || 0
    );

    const totalSynced = Number(
      data?.syncedCount ||
        shopeeCount + lazadaCount ||
        0
    );

    setSyncProgress(
      `Smart Sync complete — Shopee: ${shopeeCount}, Lazada: ${lazadaCount}`
    );

    await loadReviews();

    alert(
      `Smart Sync completed successfully.\n\n` +
      `Shopee: ${shopeeCount} reviews\n` +
      `Lazada: ${lazadaCount} reviews\n` +
      `Total: ${totalSynced} reviews`
    );
  } catch (err: any) {
    console.error(
      '[Smart Sync] Failed:',
      err
    );

    setSyncProgress(
      'Smart Sync failed.'
    );

    alert(
      `Smart Sync failed.\n\n${
        err?.message ||
        'Unknown error'
      }`
    );
  } finally {
    setSyncing(false);

    setTimeout(() => {
      setSyncProgress('');
    }, 3000);
  }
};

  // =========================================================
  // FILTERS
  // =========================================================

  const toggleStar = (star: number) => {
    setActiveStars((prev) =>
      prev.includes(star)
        ? prev.filter((s) => s !== star)
        : [...prev, star]
    );
  };

  const getReplyCategory = (review: Review): ReplyFilter => {
    if (review.status === 'REPLIED') return 'REPLIED';

    if (review.aiReply && review.aiReply.trim()) {
      return 'GENERATED';
    }

    return 'NOT_GENERATED';
  };

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const brand = (review.brand || '').toUpperCase();
      const store = (review.storeName || '').toUpperCase();

      const brandMatch =
        activeTab === 'ALL' ||
        brand === activeTab ||
        store.includes(activeTab);

      const marketplaceMatch =
        activeMarketplace === 'All' ||
        (review.marketplace || '').toUpperCase() ===
          activeMarketplace.toUpperCase();

      const starMatch =
        activeStars.length === 0 ||
        activeStars.includes(review.rating);

      const replyMatch =
        replyFilter === 'ALL' ||
        getReplyCategory(review) === replyFilter;

      return (
        brandMatch &&
        marketplaceMatch &&
        starMatch &&
        replyMatch
      );
    });
  }, [
    reviews,
    activeTab,
    activeMarketplace,
    activeStars,
    replyFilter,
  ]);

  const notGeneratedCount = reviews.filter(
    (review) => getReplyCategory(review) === 'NOT_GENERATED'
  ).length;

  const generatedCount = reviews.filter(
    (review) => getReplyCategory(review) === 'GENERATED'
  ).length;

  const repliedCount = reviews.filter(
    (review) => getReplyCategory(review) === 'REPLIED'
  ).length;

  const pendingCount = reviews.filter(
    (review) => review.status === 'PENDING'
  ).length;

  const selectedPendingIds = selectedIds.filter((id) => {
    const review = reviews.find((item) => item.id === id);

    return Boolean(
      review &&
        review.status !== 'REPLIED' &&
        !review.aiReply
    );
  });

  const selectedPendingCount = selectedPendingIds.length;

  // =========================================================
  // SELECTION
  // =========================================================

  const handleSelectAll = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.checked) {
      const ids = filteredReviews
        .filter((review) => review.status !== 'REPLIED')
        .map((review) => review.id);

      setSelectedIds(ids);
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectOne = (
    id: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  // =========================================================
  // AI GENERATION
  // =========================================================

  const generateReviewBatches = async (
    ids: string[],
    mode: 'all' | 'selected'
  ) => {
    if (ids.length === 0) {
      return {
        totalGenerated: 0,
        totalFailed: 0,
      };
    }

    let totalGenerated = 0;
    let totalFailed = 0;
    let remaining = [...ids];

    while (remaining.length > 0) {
      const batch = remaining.slice(0, BATCH_SIZE);

      const processedBefore =
        totalGenerated + totalFailed;

      const processedAfter =
        processedBefore + batch.length;

      setGenerateProgress(
        mode === 'selected'
          ? `Generating selected ${processedBefore + 1}-${processedAfter} of ${ids.length}...`
          : `Generating ${processedBefore + 1}-${processedAfter} of ${ids.length}...`
      );

      const res = await fetch('/api/reviews/generate-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: batch,
          limit: BATCH_SIZE,
        }),
      });

      let data: any = {};

      try {
        data = await res.json();
      } catch {
        data = {};
      }

      console.log('[Generate] Response:', data);

      const errorText = String(
        data.error || data.message || ''
      ).toLowerCase();

      const rateLimited =
        res.status === 429 ||
        data.rateLimited === true ||
        data.code === 'rate_limit_exceeded' ||
        errorText.includes('rate limit') ||
        errorText.includes('quota') ||
        errorText.includes('429');

      if (rateLimited) {
        totalFailed += batch.length;

        alert(
          data.message ||
            data.error ||
            'AI generation stopped because an AI provider rate limit was reached.'
        );

        break;
      }

      if (!res.ok || !data.success) {
        totalFailed += batch.length;

        console.error(
          '[Generate] Batch failed:',
          data
        );

        break;
      }

      totalGenerated += Number(data.generated || 0);
      totalFailed += Number(data.failed || 0);

      remaining = remaining.slice(batch.length);
    }

    // IMPORTANT:
    // Refresh exactly once after all batches.
    // The selected panel will automatically receive the
    // fresh aiReply because selectedReview is derived from reviews.
    await loadReviews();

    return {
      totalGenerated,
      totalFailed,
    };
  };

  // =========================================================
  // GENERATE ALL
  // =========================================================

  const handleGenerateAll = async () => {
    const pendingIds = filteredReviews
      .filter(
        (review) =>
          review.status !== 'REPLIED' &&
          !review.aiReply
      )
      .map((review) => review.id);

    if (pendingIds.length === 0) {
      alert(
        'No reviews without AI replies in the current filter.'
      );
      return;
    }

    setGenerating(true);

    try {
      const result = await generateReviewBatches(
        pendingIds,
        'all'
      );

      alert(
        `Generated ${result.totalGenerated} AI replies${
          result.totalFailed > 0
            ? `, ${result.totalFailed} failed`
            : ''
        }.`
      );
    } catch (err) {
      console.error('Generate all failed:', err);

      alert(
        err instanceof Error
          ? err.message
          : 'Failed to generate replies.'
      );
    } finally {
      setGenerating(false);
      setGenerateProgress('');
    }
  };

  // =========================================================
  // GENERATE SELECTED
  // =========================================================

  const handleGenerateSelected = async () => {
    const validIds = [...selectedIds].filter((id) => {
      const review = reviews.find((item) => item.id === id);

      return Boolean(
        review &&
          review.status !== 'REPLIED' &&
          !review.aiReply
      );
    });

    if (validIds.length === 0) {
      alert(
        'Please select one or more NOT GENERATED reviews.'
      );
      return;
    }

    setGenerating(true);

    try {
      const result = await generateReviewBatches(
        validIds,
        'selected'
      );

      alert(
        `Generated ${result.totalGenerated} selected AI replies${
          result.totalFailed > 0
            ? `, ${result.totalFailed} failed`
            : ''
        }.`
      );

      setSelectedIds((previous) =>
        previous.filter(
          (id) => !validIds.includes(id)
        )
      );
    } catch (err) {
      console.error(
        'Generate selected failed:',
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : 'Failed to generate selected replies.'
      );
    } finally {
      setGenerating(false);
      setGenerateProgress('');
    }
  };

  // =========================================================
  // GENERATE SINGLE
  // =========================================================

  const handleGenerateSingle = async () => {
    if (
      !selectedReview ||
      selectedReview.status === 'REPLIED' ||
      selectedReview.aiReply
    ) {
      return;
    }

    const id = selectedReview.id;

    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous
        : [...previous, id]
    );

    setGenerating(true);

    try {
      const result = await generateReviewBatches(
        [id],
        'selected'
      );

      alert(
        `Generated ${result.totalGenerated} AI reply${
          result.totalFailed > 0
            ? `, ${result.totalFailed} failed`
            : ''
        }.`
      );

      // Do NOT change selectedReviewId.
      // The fresh review from loadReviews() remains selected.
      setSelectedIds((previous) =>
        previous.filter((item) => item !== id)
      );
    } catch (err) {
      console.error(
        'Generate single failed:',
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : 'Failed to generate reply.'
      );
    } finally {
      setGenerating(false);
      setGenerateProgress('');
    }
  };

  // =========================================================
  // POST REPLY
  // =========================================================

  const handleReplySelected = async (
    idsToPost: string[]
  ) => {
    if (idsToPost.length === 0) return;

    const validIds = idsToPost.filter((id) => {
      const review = reviews.find((item) => item.id === id);

      return Boolean(
        review &&
          review.status !== 'REPLIED' &&
          review.aiReply
      );
    });

    if (validIds.length === 0) {
      alert(
        'No eligible generated reviews selected.'
      );
      return;
    }

    setPosting(true);

    try {
      const res = await fetch(
        '/api/reviews/reply-all',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ids: validIds,
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        const postedCount =
          data.posted !== undefined
            ? data.posted
            : validIds.length;

        alert(
          `Successfully posted ${postedCount} reply/replies!${
            data.failed > 0
              ? ` (${data.failed} failed)`
              : ''
          }`
        );

        setSelectedIds([]);
        await loadReviews();
      } else {
        alert(
          `Failed to post replies: ${
            data.error || 'Unknown error'
          }`
        );
      }
    } catch (err: any) {
      console.error(
        'Reply posting error:',
        err
      );

      alert(
        `Error posting replies: ${
          err?.message || 'Unknown error'
        }`
      );
    } finally {
      setPosting(false);
    }
  };

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col flex-1">

      <header className="border-b border-gray-800 px-8 py-4 flex items-center justify-between bg-gray-900">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-wide text-white">
              Reviews
            </h1>
            <span className="text-gray-400">
              — Heart of System
            </span>
          </div>

          <div className="text-xs text-gray-400 mt-1 flex gap-4">
            <span>AI Fetch</span>
            <span>•</span>
            <span>Live Shopee API</span>
            <span>•</span>
            <span>From Day 1</span>
            <span>•</span>
            <span>NOVA summary</span>
            <span>•</span>
            <span>Reply Comment API</span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {syncing && syncProgress && (
            <span className="text-xs text-blue-400">
              {syncProgress}
            </span>
          )}

          {generating && generateProgress && (
            <span className="text-xs text-purple-400">
              {generateProgress}
            </span>
          )}

          {selectedIds.length > 0 && (
            <button
              onClick={() =>
                handleReplySelected(selectedIds)
              }
              disabled={
                posting ||
                syncing ||
                generating
              }
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50"
            >
              {posting
                ? 'Posting...'
                : `Reply Selected (${selectedIds.length})`}
            </button>
          )}

          <button
            onClick={handleGenerateSelected}
            disabled={
              generating ||
              syncing ||
              posting ||
              selectedPendingCount === 0
            }
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50"
          >
            {generating
              ? 'Generating...'
              : `Generate Selected (${selectedPendingCount})`}
          </button>

          <button
            onClick={handleGenerateAll}
            disabled={
              generating ||
              syncing ||
              posting
            }
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50"
          >
            {generating
              ? 'Generating...'
              : 'Generate All Replies'}
          </button>

          <button
  onClick={handleSync}
  disabled={
    syncing ||
    generating ||
    posting
  }
  className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg font-medium shadow-lg disabled:opacity-50"
>
  {syncing
    ? 'Smart Syncing...'
    : 'Smart Sync — Shopee + Lazada'}
</button>

          <div className="bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 text-xs flex items-center gap-2">
            <span className="text-gray-400">
              Pending
            </span>
            <span className="text-amber-500 font-bold">
              {pendingCount}
            </span>
          </div>
        </div>
      </header>

      <div className="px-8 py-4 border-b border-gray-800 bg-gray-900 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">
            Replies:
          </span>

          {[
            {
              key: 'NOT_GENERATED' as ReplyFilter,
              label: 'Not Generated',
              count: notGeneratedCount,
            },
            {
              key: 'GENERATED' as ReplyFilter,
              label: 'Generated',
              count: generatedCount,
            },
            {
              key: 'REPLIED' as ReplyFilter,
              label: 'Replied',
              count: repliedCount,
            },
            {
              key: 'ALL' as ReplyFilter,
              label: 'All',
              count: reviews.length,
            },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() =>
                setReplyFilter(filter.key)
              }
              className={`px-4 py-1.5 rounded-full text-xs font-medium ${
                replyFilter === filter.key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  filteredReviews.length > 0 &&
                  filteredReviews
                    .filter(
                      (review) =>
                        review.status !== 'REPLIED'
                    )
                    .every((review) =>
                      selectedIds.includes(
                        review.id
                      )
                    )
                }
                onChange={handleSelectAll}
                className="w-4 h-4 rounded bg-gray-800 border-gray-700"
              />
              Select All Filtered
            </label>

            <div className="flex gap-2 flex-wrap">
              {[
                'ALL',
                'RAV',
                'NICOLE',
                'OBERMAIN',
                'HUSH',
                'BHPC',
                'JOHN_LANGFORD',
              ].map((brand) => (
                <button
                  key={brand}
                  onClick={() =>
                    setActiveTab(brand)
                  }
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${
                    activeTab === brand
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                >
                  {brand}
                  {brand === 'ALL' &&
                    ` (${reviews.length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-gray-500">
              Stars:
            </span>

            {[5, 4, 3, 2, 1].map((star) => (
              <button
                key={star}
                onClick={() =>
                  toggleStar(star)
                }
                className={`px-3 py-1 rounded-full text-xs border ${
                  activeStars.includes(star)
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                }`}
              >
                {star}★
              </button>
            ))}

            {activeStars.length > 0 && (
              <button
                onClick={() =>
                  setActiveStars([])
                }
                className="text-xs text-gray-500 underline"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex gap-2 bg-gray-800 p-1 rounded-full border border-gray-700">
            {['All', 'Shopee', 'Lazada'].map(
              (marketplace) => (
                <button
                  key={marketplace}
                  onClick={() =>
                    setActiveMarketplace(
                      marketplace
                    )
                  }
                  className={`px-3 py-1 rounded-full text-xs ${
                    activeMarketplace === marketplace
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400'
                  }`}
                >
                  {marketplace}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 p-8 gap-6 overflow-hidden bg-gray-950">

        <div className="lg:col-span-2 space-y-4 overflow-y-auto pr-2 max-h-[calc(100vh-280px)]">
          {loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-400">
              Loading reviews...
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-400">
              No reviews found for this filter.
            </div>
          ) : (
            filteredReviews.map((review) => {
              const isSelected =
                selectedIds.includes(review.id);

              const isReplied =
                review.status === 'REPLIED';

              return (
                <div
                  key={review.id}
                  onClick={() =>
                    setSelectedReviewId(review.id)
                  }
                  className={`border rounded-xl p-5 cursor-pointer transition-all flex gap-4 items-start ${
                    selectedReviewId === review.id
                      ? 'border-blue-500 bg-gray-800'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isReplied}
                    onClick={(e) =>
                      toggleSelectOne(
                        review.id,
                        e
                      )
                    }
                    onChange={() => {}}
                    className="mt-1 w-4 h-4 rounded bg-gray-800 border-gray-700"
                  />

                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white text-sm">
                        {review.productName ||
                          'Unknown Product'}
                      </h3>

                      <div className="flex items-center gap-2">
                        {isReplied ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            REPLIED
                          </span>
                        ) : review.aiReply ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            AI READY
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20">
                            NOT GENERATED
                          </span>
                        )}

                        {!isReplied && (
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {review.status}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-400 mb-2">
                      {review.customerName} •{' '}
                      {review.storeName}
                    </p>

                    <div className="text-amber-400 text-xs mb-3">
                      {'★'.repeat(
                        Math.max(
                          0,
                          Math.min(5, review.rating)
                        )
                      )}
                      {'☆'.repeat(
                        Math.max(
                          0,
                          5 -
                            Math.max(
                              0,
                              Math.min(
                                5,
                                review.rating
                              )
                            )
                        )
                      )}
                      <span className="text-gray-500 ml-2 font-mono uppercase">
                        ({review.marketplace})
                      </span>
                    </div>

                    <p className="text-sm text-gray-300 italic">
                      "{review.reviewText || ''}"
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col justify-between h-fit">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold tracking-wider text-purple-400 uppercase">
                ✦ NOVA AI REPLY GENERATOR
              </span>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-2">
                SELECTED REVIEW
              </p>

              <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300">
                {selectedReview ? (
                  <>
                    <p className="italic mb-1 font-medium text-white">
                      "{selectedReview.reviewText ||
                        '[No written review]'}"
                    </p>

                    <p className="text-gray-500">
                      {selectedReview.customerName} •{' '}
                      {selectedReview.productName ||
                        'Unknown Product'} •{' '}
                      {selectedReview.rating}★
                    </p>

                    <p className="text-gray-600 mt-1">
                      {selectedReview.status}
                    </p>
                  </>
                ) : (
                  <p className="text-gray-500 italic">
                    Select a review from the list to view options.
                  </p>
                )}
              </div>
            </div>

            {selectedReview && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">
                  AI GENERATED REPLY
                </p>

                <textarea
                  readOnly
                  rows={6}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-200 resize-none outline-none"
                  value={selectedReview.aiReply || ''}
                  placeholder="No AI reply generated yet."
                />

                {selectedReview.aiReply && (
                  <div className="mt-2 text-[11px] text-emerald-400">
                    ✓ AI reply loaded from database
                  </div>
                )}
              </div>
            )}
          </div>

          {selectedReview && (
            <div className="space-y-3 mt-4">
              {!selectedReview.aiReply &&
                selectedReview.status !== 'REPLIED' && (
                  <button
                    onClick={handleGenerateSingle}
                    disabled={
                      generating ||
                      syncing ||
                      posting
                    }
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                  >
                    {generating
                      ? 'Generating...'
                      : 'Generate AI Reply'}
                  </button>
                )}

              {selectedReview.status !== 'REPLIED' && (
                <button
                  onClick={() =>
                    handleReplySelected([
                      selectedReview.id,
                    ])
                  }
                  disabled={
                    posting ||
                    syncing ||
                    generating ||
                    !selectedReview.aiReply
                  }
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg disabled:opacity-50"
                >
                  {posting
                    ? 'Posting...'
                    : selectedReview.aiReply
                    ? 'Approve & Reply (Reply Comment API)'
                    : 'Generate Reply First'}
                </button>
              )}

              {selectedReview.status === 'REPLIED' && (
                <div className="w-full py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg text-center">
                  ✓ Already Replied
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}