"use client";

import React, { useEffect, useState } from "react";

interface Review {
  id: string;
  reviewId: string;
  marketplace: string;
  brand?: string;
  productName: string;
  productSku?: string;
  rating: number;
  reviewText: string;
  customerName: string;
  aiReply?: string;
  status: string;
  createdAt: string;
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reviews");
      const data = await res.json();

      // Flexible response parsing to guarantee compatibility with any API structure
      let reviewList: Review[] = [];
      let totalCount = 0;

      if (Array.isArray(data)) {
        reviewList = data;
        totalCount = data.length;
      } else if (data && Array.isArray(data.reviews)) {
        reviewList = data.reviews;
        totalCount = data.total ?? data.reviews.length;
      } else if (data && Array.isArray(data.data)) {
        reviewList = data.data;
        totalCount = data.total ?? data.data.length;
      }

      setReviews(reviewList);
      setTotal(totalCount);
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await fetch("/api/reviews/sync", { method: "POST" });
      await res.json();
      alert("Sync completed successfully!");
      fetchReviews();
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Sync failed. Check console for details.");
    } finally {
      setSyncing(false);
    }
  };

  const filteredReviews = reviews.filter((rev) => {
    const matchesSearch =
      rev.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rev.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rev.reviewText?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || rev.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-lg">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Customer Reviews Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Manage marketplace feedback, view AI reply drafts, and synchronize new reviews.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-gray-800 rounded-lg border border-gray-700 text-sm font-medium">
              Total Reviews: <span className="text-indigo-400 font-bold">{total}</span>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow"
            >
              {syncing ? "Syncing..." : "Sync Reviews"}
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
          <input
            type="text"
            placeholder="Search by product, customer, or review text..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-96 px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            {["ALL", "PENDING", "APPROVED"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Review List */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading reviews from database...</div>
        ) : filteredReviews.length === 0 ? (
          <div className="text-center py-20 bg-gray-900 border border-gray-800 rounded-xl text-gray-400">
            No reviews found matching your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredReviews.map((review) => (
              <div
                key={review.id || review.reviewId}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-md hover:border-gray-700 transition-all space-y-4"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b border-gray-800 pb-3">
                  <div>
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-950 text-indigo-300 border border-indigo-800/50 rounded uppercase tracking-wider">
                      {review.marketplace}
                    </span>
                    <h3 className="text-lg font-semibold text-white mt-1">
                      {review.productName}
                    </h3>
                    {review.productSku && (
                      <span className="text-xs text-gray-400">SKU: {review.productSku}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex text-amber-400 text-sm">
                      {"★".repeat(review.rating)}
                      {"☆".repeat(5 - review.rating)}
                    </div>
                    <span className="text-xs text-gray-400">
                      By <strong className="text-gray-200">{review.customerName}</strong>
                    </span>
                  </div>
                </div>

                <p className="text-gray-300 text-sm leading-relaxed bg-gray-950/50 p-4 rounded-lg border border-gray-800/80">
                  {review.reviewText || "(No review text provided)"}
                </p>

                {review.aiReply && (
                  <div className="bg-indigo-950/30 border border-indigo-900/40 p-4 rounded-lg space-y-1">
                    <div className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                      AI Reply Draft
                    </div>
                    <p className="text-sm text-indigo-200">{review.aiReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}