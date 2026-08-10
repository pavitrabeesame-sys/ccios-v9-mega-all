'use client';

import React, { useState, useEffect } from 'react';

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

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] =
    useState<boolean>(true);

  const [syncing, setSyncing] =
    useState<boolean>(false);

  const [syncProgress, setSyncProgress] =
    useState<string>('');

  const [generating, setGenerating] =
    useState<boolean>(false);

  const [generateProgress, setGenerateProgress] =
    useState<string>('');

  const [selectedReview, setSelectedReview] =
    useState<Review | null>(null);

  const [activeTab, setActiveTab] =
    useState<string>('ALL');

  const [activeMarketplace, setActiveMarketplace] =
    useState<string>('All');

  const [activeStars, setActiveStars] =
    useState<number[]>([]);

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [posting, setPosting] =
    useState<boolean>(false);

  // =========================================================
  // LOAD REVIEWS
  // =========================================================

  const loadReviews = async () => {
    try {
      const res = await fetch(
        '/api/reviews',
        {
          cache: 'no-store',
        }
      );

      const data = await res.json();

      if (Array.isArray(data)) {
        setReviews(data);

        if (
          !selectedReview &&
          data.length > 0
        ) {
          setSelectedReview(data[0]);
        }
      }
    } catch (err) {
      console.error(
        'Failed to load reviews:',
        err
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  // =========================================================
  // SYNC LIVE SHOPEE REVIEWS
  // =========================================================

  const handleSync = async () => {
    setSyncing(true);

    try {
      const shopsRes = await fetch(
        '/api/shopee/shops',
        {
          cache: 'no-store',
        }
      );

      const shopsData =
        await shopsRes.json();

      const shopIds: string[] =
        shopsData.shopIds || [];

      if (shopIds.length === 0) {
        alert(
          'No authorized Shopee shops found.'
        );
        return;
      }

      let totalSynced = 0;

      const errors: string[] = [];

      for (
        let i = 0;
        i < shopIds.length;
        i++
      ) {
        const shopId = shopIds[i];

        setSyncProgress(
          `Syncing shop ${i + 1}/${shopIds.length}...`
        );

        try {
          const res = await fetch(
            `/api/reviews/sync?shopId=${shopId}`,
            {
              method: 'POST',
            }
          );

          const data =
            await res.json();

          if (data.success) {
            totalSynced +=
              Number(
                data.syncedCount || 0
              );
          } else {
            errors.push(
              `Shop ${shopId}: ${
                data.error ||
                'Unknown error'
              }`
            );
          }
        } catch (err: any) {
          errors.push(
            `Shop ${shopId}: ${
              err?.message ||
              'Unknown error'
            }`
          );
        }

        await loadReviews();
      }

      setSyncProgress('');

      if (errors.length > 0) {
        alert(
          `Synced ${totalSynced} reviews. ${
            errors.length
          } shop(s) had issues:\n${errors.join(
            '\n'
          )}`
        );
      } else {
        alert(
          `Successfully synchronized ${totalSynced} reviews across ${shopIds.length} shops!`
        );
      }
    } catch (err) {
      console.error(
        'Sync failed:',
        err
      );

      alert(
        'Failed to connect to Shopee sync route.'
      );
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  };

  // =========================================================
  // STAR FILTER
  // =========================================================

  const toggleStar = (
    star: number
  ) => {
    setActiveStars((prev) =>
      prev.includes(star)
        ? prev.filter(
            (s) => s !== star
          )
        : [...prev, star]
    );
  };

  // =========================================================
  // FILTER REVIEWS
  // =========================================================

  const filteredReviews =
    reviews.filter((r) => {
      const brand =
        (r.brand || '').toUpperCase();

      const store =
        (r.storeName || '').toUpperCase();

      const brandMatch =
        activeTab === 'ALL' ||
        brand === activeTab ||
        store.includes(activeTab);

      const marketMatch =
        activeMarketplace === 'All' ||
        (r.marketplace || '')
          .toUpperCase() ===
          activeMarketplace.toUpperCase();

      const starMatch =
        activeStars.length === 0 ||
        activeStars.includes(
          r.rating
        );

      return (
        brandMatch &&
        marketMatch &&
        starMatch
      );
    });

  // =========================================================
  // SELECT ALL
  // =========================================================

  const handleSelectAll = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.checked) {
      const allFilteredIds =
        filteredReviews.map(
          (r) => r.id
        );

      setSelectedIds(
        allFilteredIds
      );
    } else {
      setSelectedIds([]);
    }
  };

  // =========================================================
  // SELECT ONE
  // =========================================================

  const toggleSelectOne = (
    id: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();

    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter(
            (i) => i !== id
          )
        : [...prev, id]
    );
  };

  // =========================================================
  // GENERATE ALL AI REPLIES
  // =========================================================

  const handleGenerateAll =
    async () => {
      const pendingIds =
        filteredReviews
          .filter(
            (r) => !r.aiReply
          )
          .map(
            (r) => r.id
          );

      setGenerating(true);

      try {
        // =====================================================
        // FALLBACK
        // =====================================================

        if (
          pendingIds.length === 0
        ) {
          setGenerateProgress(
            'Generating AI reply...'
          );

          const res =
            await fetch(
              '/api/reviews/generate-all',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify(
                  {
                    limit:
                      BATCH_SIZE,
                  }
                ),
              }
            );

          const data =
            await res.json();

          console.log(
            '[Generate All Fallback]',
            data
          );

          if (
            !res.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                data.message ||
                'AI generation request failed'
            );
          }

          const generated =
            Number(
              data.generated || 0
            );

          const failed =
            Number(
              data.failed || 0
            );

          await loadReviews();

          if (
            generated > 0
          ) {
            alert(
              `Generated ${generated} AI replies${
                failed > 0
                  ? `, ${failed} failed`
                  : ''
              }.`
            );
          } else {
            alert(
              data.message ||
                'No reviews require AI generation or regeneration.'
            );
          }

          return;
        }

        // =====================================================
        // NORMAL BATCH GENERATION
        // =====================================================

        let totalGenerated = 0;

        let totalFailed = 0;

        let remaining = [
          ...pendingIds,
        ];

        while (
          remaining.length > 0
        ) {
          const batch =
            remaining.slice(
              0,
              BATCH_SIZE
            );

          const processedBefore =
            totalGenerated +
            totalFailed;

          const processedAfter =
            processedBefore +
            batch.length;

          setGenerateProgress(
            `Generating ${
              processedBefore + 1
            }-${processedAfter} of ${
              pendingIds.length
            }...`
          );

          console.log(
            '[Generate All] Sending batch:',
            batch
          );

          const res =
            await fetch(
              '/api/reviews/generate-all',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify(
                  {
                    ids: batch,
                    limit:
                      BATCH_SIZE,
                  }
                ),
              }
            );

          const data =
            await res.json();

          console.log(
            '[Generate All] Response:',
            data
          );

          if (
            !res.ok ||
            !data.success
          ) {
            totalFailed +=
              batch.length;

            console.error(
              '[Generate All] Batch failed:',
              data
            );
          } else {
            totalGenerated +=
              Number(
                data.generated ||
                  0
              );

            totalFailed +=
              Number(
                data.failed || 0
              );
          }

          remaining =
            remaining.slice(
              batch.length
            );

          await loadReviews();
        }

        setGenerateProgress('');

        alert(
          `Generated ${totalGenerated} AI replies${
            totalFailed > 0
              ? `, ${totalFailed} failed`
              : ''
          }.`
        );
      } catch (err) {
        console.error(
          'Generate all failed:',
          err
        );

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
  // POST REPLY
  // =========================================================

  const handleReplySelected =
    async (
      idsToPost: string[]
    ) => {
      if (
        idsToPost.length === 0
      ) {
        return;
      }

      setPosting(true);

      try {
        const res =
          await fetch(
            '/api/reviews/reply-all',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                ids: idsToPost,
              }),
            }
          );

        const data =
          await res.json();

        if (data.success) {
          const postedCount =
            data.posted !==
            undefined
              ? data.posted
              : idsToPost.length;

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
              data.error ||
              'Unknown error'
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
            err?.message ||
            'Unknown error'
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

      {/* HEADER */}

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

        <div className="flex items-center gap-3">

          {syncing &&
            syncProgress && (
              <span className="text-xs text-blue-400">
                {syncProgress}
              </span>
            )}

          {generating &&
            generateProgress && (
              <span className="text-xs text-purple-400">
                {generateProgress}
              </span>
            )}

          {selectedIds.length >
            0 && (
            <button
              onClick={() =>
                handleReplySelected(
                  selectedIds
                )
              }
              disabled={
                posting ||
                syncing ||
                generating
              }
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-lg disabled:opacity-50 cursor-pointer animate-pulse"
            >

              <svg
                className={`w-4 h-4 ${
                  posting
                    ? 'animate-spin'
                    : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>

              {posting
                ? 'Posting...'
                : `Reply Selected (${selectedIds.length})`}

            </button>
          )}

          <button
            onClick={
              handleGenerateAll
            }
            disabled={
              generating ||
              syncing
            }
            className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-lg disabled:opacity-50 cursor-pointer"
          >

            <svg
              className={`w-4 h-4 ${
                generating
                  ? 'animate-spin'
                  : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>

            {generating
              ? 'Generating...'
              : 'Generate All Replies'}

          </button>

          <button
            onClick={
              handleSync
            }
            disabled={
              syncing ||
              generating
            }
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-lg disabled:opacity-50 cursor-pointer"
          >

            <svg
              className={`w-4 h-4 ${
                syncing
                  ? 'animate-spin'
                  : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>

            {syncing
              ? 'Syncing Live...'
              : 'Sync Live Reviews (Shopee)'}

          </button>

          <div className="bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 text-xs flex items-center gap-2">

            <span className="text-gray-400">
              Pending
            </span>

            <span className="text-amber-500 font-bold">
              {
                reviews.filter(
                  (r) =>
                    r.status ===
                    'PENDING'
                ).length
              }
            </span>

          </div>

        </div>
      </header>

      {/* FILTER BAR */}

      <div className="px-8 py-4 border-b border-gray-800 bg-gray-900 flex items-center justify-between flex-wrap gap-3">

        <div className="flex items-center gap-4">

          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">

            <input
              type="checkbox"
              checked={
                filteredReviews.length >
                  0 &&
                selectedIds.length ===
                  filteredReviews.length
              }
              onChange={
                handleSelectAll
              }
              className="rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
            />

            <span>
              Select All Filtered
            </span>

          </label>

          <div className="flex gap-2">

            {[
              'ALL',
              'RAV',
              'NICOLE',
              'OBERMAIN',
              'HUSH',
              'BHPC',
              'JOHN_LANGFORD',
            ].map(
              (brand) => (
                <button
                  key={brand}
                  onClick={() =>
                    setActiveTab(
                      brand
                    )
                  }
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                    activeTab ===
                    brand
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
                  }`}
                >
                  {brand}{' '}
                  {brand ===
                    'ALL' &&
                    `(${reviews.length})`}
                </button>
              )
            )}

          </div>
        </div>

        <div className="flex gap-2 items-center">

          <span className="text-xs text-gray-500 mr-1">
            Stars:
          </span>

          {[5, 4, 3, 2, 1].map(
            (star) => (
              <button
                key={star}
                onClick={() =>
                  toggleStar(star)
                }
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${
                  activeStars.includes(
                    star
                  )
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                }`}
              >
                {star}★
              </button>
            )
          )}

          {activeStars.length >
            0 && (
            <button
              onClick={() =>
                setActiveStars([])
              }
              className="text-xs text-gray-500 hover:text-white underline cursor-pointer ml-1"
            >
              Clear
            </button>
          )}

        </div>

        <div className="flex gap-2 bg-gray-800 p-1 rounded-full border border-gray-700">

          {[
            'All',
            'Shopee',
            'Lazada',
          ].map(
            (mkt) => (
              <button
                key={mkt}
                onClick={() =>
                  setActiveMarketplace(
                    mkt
                  )
                }
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeMarketplace ===
                  mkt
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {mkt}
              </button>
            )
          )}

        </div>
      </div>

      {/* MAIN */}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 p-8 gap-6 overflow-hidden bg-gray-950">

        {/* REVIEW LIST */}

        <div className="lg:col-span-2 space-y-4 overflow-y-auto pr-2 max-h-[calc(100vh-220px)]">

          {loading ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-400">
              Loading reviews...
            </div>
          ) : filteredReviews.length ===
            0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-gray-400">
              No reviews found for this filter. Click "Sync Live Reviews" to fetch from Shopee.
            </div>
          ) : (
            filteredReviews.map(
              (
                review,
                idx
              ) => {

                const isSelected =
                  selectedIds.includes(
                    review.id
                  );

                return (
                  <div
                    key={
                      review.id ||
                      review.reviewId ||
                      idx
                    }
                    onClick={() =>
                      setSelectedReview(
                        review
                      )
                    }
                    className={`border rounded-xl p-5 cursor-pointer transition-all shadow-sm flex gap-4 items-start ${
                      selectedReview?.reviewId ===
                      review.reviewId
                        ? 'border-blue-500 bg-gray-800'
                        : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                    }`}
                  >

                    <input
                      type="checkbox"
                      checked={
                        isSelected
                      }
                      onClick={(
                        e
                      ) =>
                        toggleSelectOne(
                          review.id,
                          e
                        )
                      }
                      onChange={() => {}}
                      className="mt-1 rounded bg-gray-800 border-gray-700 text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                    />

                    <div className="flex-1">

                      <div className="flex justify-between items-start mb-2">

                        <h3 className="font-semibold text-white text-sm">
                          {review.productName ||
                            'Unknown Product'}
                        </h3>

                        <div className="flex items-center gap-2">

                          {review.aiReply && (
                            <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium border border-purple-500/20">
                              AI READY
                            </span>
                          )}

                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                            {review.status}
                          </span>

                        </div>

                      </div>

                      <p className="text-xs text-gray-400 mb-2">
                        {review.customerName}{' '}
                        •{' '}
                        {review.storeName}
                      </p>

                      <div className="text-amber-400 text-xs mb-3">

                        {'★'.repeat(
                          Math.max(
                            0,
                            Math.min(
                              5,
                              review.rating
                            )
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
              }
            )
          )}

        </div>

        {/* NOVA PANEL */}

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
                      "{selectedReview.reviewText}"
                    </p>

                    <p className="text-gray-500">
                      {selectedReview.customerName}{' '}
                      •{' '}
                      {selectedReview.productName}{' '}
                      •{' '}
                      {selectedReview.rating}★
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
                  rows={3}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-200 resize-none outline-none"
                  value={
                    selectedReview.aiReply ||
                    `Thank you for your kind review. We're delighted that you're enjoying your purchase from ${selectedReview.storeName.replace(
                      /\s*\([^)]*\)\s*$/,
                      ''
                    )}. Your satisfaction is our priority, and we sincerely appreciate your support. We look forward to serving you again.`
                  }
                />

              </div>
            )}

          </div>

          {selectedReview && (
            <div className="space-y-3 mt-4">

              <button
                onClick={() =>
                  handleReplySelected([
                    selectedReview.id,
                  ])
                }
                disabled={
                  posting ||
                  syncing ||
                  generating
                }
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg cursor-pointer disabled:opacity-50"
              >
                {posting
                  ? 'Posting...'
                  : 'Approve & Reply (Reply Comment API)'}
              </button>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}