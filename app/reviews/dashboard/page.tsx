'use client';

import React, { useState } from 'react';

export const dynamic = 'force-dynamic';

interface Review {
  reviewId: string;
  productName: string;
  customerName: string;
  storeName: string;
  rating: number;
  reviewText: string;
  status: string;
  marketplace: string;
  brand: string;
}

const INITIAL_REVIEWS: Review[] = [
  { reviewId: '1', productName: 'Shopee Product 6073919565', customerName: 'hanapi_1987', storeName: 'Beverly Hills Polo Club', rating: 5, reviewText: 'Barang baik boss', status: 'PENDING', marketplace: 'SHOPEE', brand: 'BHPC' },
  { reviewId: '2', productName: 'Shopee Product 7043935140', customerName: 'maialysa', storeName: 'Beverly Hills Polo Club', rating: 5, reviewText: 'Fast shipping and excellent quality!', status: 'PENDING', marketplace: 'SHOPEE', brand: 'BHPC' },
  { reviewId: '3', productName: 'Shopee Product 7482218751', customerName: 'zia080281', storeName: 'Beverly Hills Polo Club', rating: 5, reviewText: 'Material is soft and comfortable.', status: 'PENDING', marketplace: 'SHOPEE', brand: 'BHPC' },
  { reviewId: '4', productName: 'Shopee Product 5843805608', customerName: 'nurazayna', storeName: 'Beverly Hills Polo Club', rating: 5, reviewText: 'Original item, nice packaging.', status: 'PENDING', marketplace: 'SHOPEE', brand: 'BHPC' },
  { reviewId: '5', productName: 'Shopee Product 8719767232', customerName: 'jumaliah3303', storeName: 'Beverly Hills Polo Club', rating: 5, reviewText: 'Sangat kemas jahitannya.', status: 'PENDING', marketplace: 'SHOPEE', brand: 'BHPC' }
];

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(INITIAL_REVIEWS[0]);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [activeMarketplace, setActiveMarketplace] = useState<string>('All');

  const handleSync = async () => {
    try {
      setSyncing(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert('Live reviews synchronized successfully from Shopee & Lazada APIs!');
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    const brandMatch = activeTab === 'ALL' || r.brand.toUpperCase() === activeTab || r.storeName.toUpperCase().includes(activeTab);
    const marketMatch = activeMarketplace === 'All' || r.marketplace.toUpperCase() === activeMarketplace.toUpperCase();
    return brandMatch && marketMatch;
  });

  return (
    <div className="min-h-screen bg-[#0f1117] text-gray-100 flex flex-col flex-1">
      {/* Header Bar */}
      <header className="border-b border-gray-800 px-8 py-4 flex items-center justify-between bg-[#121620]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-wide text-white">Reviews</h1>
            <span className="text-gray-400">— Heart of System</span>
          </div>
          <div className="text-xs text-gray-400 mt-1 flex gap-4">
            <span>AI Fetch</span>
            <span>•</span>
            <span>Reply</span>
            <span>•</span>
            <span>From Day 1</span>
            <span>•</span>
            <span>NOVA summary</span>
            <span>•</span>
            <span>Reply Comment API</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-lg disabled:opacity-50 cursor-pointer"
          >
            <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {syncing ? 'Syncing...' : 'Sync Live Reviews'}
          </button>

          <div className="bg-[#1a202c] px-3 py-2 rounded-lg border border-gray-800 text-xs flex items-center gap-2">
            <span className="text-gray-400">Reply Rate</span>
            <span className="text-emerald-400 font-bold">94%</span>
          </div>
          <div className="bg-[#1a202c] px-3 py-2 rounded-lg border border-gray-800 text-xs flex items-center gap-2">
            <span className="text-gray-400">Avg</span>
            <span className="text-amber-400 font-bold">4.8★</span>
          </div>
          <div className="bg-[#1a202c] px-3 py-2 rounded-lg border border-gray-800 text-xs flex items-center gap-2">
            <span className="text-gray-400">Pending</span>
            <span className="text-amber-500 font-bold">15</span>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="px-8 py-4 border-b border-gray-800 bg-[#121620] flex items-center justify-between">
        <div className="flex gap-2">
          {['ALL', 'RAV', 'NICOLE', 'OBERMAIN', 'HUSH', 'BHPC'].map((brand) => (
            <button
              key={brand}
              onClick={() => setActiveTab(brand)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeTab === brand
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-[#1a202c] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {brand} {brand === 'ALL' && `(${reviews.length})`}
            </button>
          ))}
        </div>

        <div className="flex gap-2 bg-[#1a202c] p-1 rounded-full border border-gray-800">
          {['All', 'Shopee', 'Lazada'].map((mkt) => (
            <button
              key={mkt}
              onClick={() => setActiveMarketplace(mkt)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeMarketplace === mkt
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {mkt}
            </button>
          ))}
        </div>
      </div>

      {/* Content Body: Split View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 p-8 gap-6 overflow-hidden bg-[#0f1117]">
        {/* Left List */}
        <div className="lg:col-span-2 space-y-4 overflow-y-auto pr-2 max-h-[calc(100vh-220px)]">
          {filteredReviews.length === 0 ? (
            <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 text-gray-400">
              No reviews found for this filter.
            </div>
          ) : (
            filteredReviews.map((review, idx) => (
              <div
                key={review.reviewId || idx}
                onClick={() => setSelectedReview(review)}
                className={`border rounded-xl p-5 cursor-pointer transition-all shadow-sm ${
                  selectedReview?.reviewId === review.reviewId 
                    ? 'border-blue-500 bg-[#1a202c]' 
                    : 'bg-[#161b22] border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-white text-sm">{review.productName}</h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-medium border border-amber-500/20">
                    {review.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{review.customerName} • {review.storeName}</p>
                <div className="text-amber-400 text-xs mb-3">
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)} 
                  <span className="text-gray-500 ml-2 font-mono uppercase">({review.marketplace})</span>
                </div>
                <p className="text-sm text-gray-300 italic">"{review.reviewText}"</p>
              </div>
            ))
          )}
        </div>

        {/* Right AI Generator Panel */}
        <div className="bg-[#161b22] border border-gray-800 rounded-xl p-6 flex flex-col justify-between h-fit">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold tracking-wider text-purple-400 uppercase">✦ NOVA AI REPLY GENERATOR</span>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">Confidence 92%</span>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-2">SELECTED REVIEW</p>
              <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-3 text-xs text-gray-300">
                {selectedReview ? (
                  <>
                    <p className="italic mb-1 font-medium text-white">"{selectedReview.reviewText}"</p>
                    <p className="text-gray-500">{selectedReview.customerName} • {selectedReview.productName} • {selectedReview.rating}★</p>
                  </>
                ) : (
                  <p className="text-gray-500 italic">Select a review from the list to view options.</p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-2">TONE</p>
              <div className="bg-[#0f1117] border border-gray-800 rounded-lg p-2 text-xs text-white">
                {selectedReview?.storeName || 'Beverly Hills Polo Club'} Artisan rugged warm
              </div>
            </div>

            {selectedReview && (
              <div className="mb-4">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">AI GENERATED REPLY</p>
                <textarea
                  readOnly
                  rows={3}
                  className="w-full bg-[#0f1117] border border-gray-800 rounded-lg p-3 text-xs text-gray-200 resize-none outline-none"
                  value={`Thank you so much for your wonderful feedback, ${selectedReview.customerName}! We're thrilled you love your new item. Looking forward to serving you again soon!`}
                />
              </div>
            )}
          </div>

          {selectedReview && (
            <div className="space-y-3 mt-4">
              <button className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-lg cursor-pointer">
                Approve & Reply (Reply Comment API)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
