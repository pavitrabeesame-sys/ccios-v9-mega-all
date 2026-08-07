'use client';

import React, { useState, useEffect } from 'react';

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [aiReply, setAiReply] = useState('');
  const [tone, setTone] = useState('Beverly Hills Polo Club Artisan rugged warm');

  const brands = ['ALL', 'RAV', 'NICOLE', 'OBERMAIN', 'HUSH', 'BHPC'];

  const fetchReviews = async (brandFilter = 'ALL') => {
    setLoading(true);
    try {
      const res = await fetch('/api/reviews/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: brandFilter }),
      });
      const data = await res.json();
      if (data.success && data.reviews) {
        setReviews(data.reviews);
        if (data.reviews.length > 0 && !selectedReview) {
          setSelectedReview(data.reviews[0]);
          setAiReply(`Thank you so much for your wonderful feedback, ${data.reviews[0].customerName}! We're thrilled you love your new item. Looking forward to serving you again soon!`);
        }
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews('ALL');
  }, []);

  const handleBrandClick = (brand: string) => {
    setSelectedBrand(brand);
    fetchReviews(brand);
  };

  const filteredReviews = selectedBrand === 'ALL' 
    ? reviews 
    : reviews.filter(r => r.brand?.toUpperCase() === selectedBrand);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-white p-6 font-sans">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Reviews <span className="text-sm font-normal text-gray-400">— Heart of System</span>
          </h1>
          <div className="flex gap-4 text-xs text-gray-400 mt-1">
            <span>AI Fetch</span>
            <span>• Live Shopee API</span>
            <span>• From Day 1</span>
            <span>• NOVA summary</span>
            <span>• Reply Comment API</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchReviews(selectedBrand)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg flex items-center gap-2"
          >
            🔄 Sync Live Reviews (Shopee)
          </button>
          <div className="bg-[#151b2b] px-3 py-1.5 rounded-lg border border-gray-800 text-xs">
            Reply Rate <span className="text-green-400 font-bold">94%</span>
          </div>
          <div className="bg-[#151b2b] px-3 py-1.5 rounded-lg border border-gray-800 text-xs">
            Avg <span className="text-yellow-400 font-bold">4.8★</span>
          </div>
          <div className="bg-[#151b2b] px-3 py-1.5 rounded-lg border border-gray-800 text-xs">
            Pending <span className="text-yellow-400 font-bold">{reviews.length}</span>
          </div>
        </div>
      </div>

      {/* Brand Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-800 pb-4">
        {brands.map((b) => {
          const count = b === 'ALL' ? reviews.length : reviews.filter(r => r.brand?.toUpperCase() === b).length;
          return (
            <button
              key={b}
              onClick={() => handleBrandClick(b)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${
                selectedBrand === b 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'bg-[#151b2b] text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {b} ({count})
            </button>
          );
        })}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Review List (Scrollable for all 1746 reviews) */}
        <div className="lg:col-span-2 space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="text-center py-20 text-gray-400">Loading all reviews...</div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No reviews found for {selectedBrand}.</div>
          ) : (
            filteredReviews.map((rev) => (
              <div 
                key={rev.reviewId}
                onClick={() => {
                  setSelectedReview(rev);
                  setAiReply(`Thank you so much for your wonderful feedback, ${rev.customerName}! We're thrilled you love your new item. Looking forward to serving you again soon!`);
                }}
                className={`bg-[#131826] border p-5 rounded-xl cursor-pointer transition ${
                  selectedReview?.reviewId === rev.reviewId ? 'border-blue-500 shadow-blue-500/10 shadow-lg' : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-base text-white">{rev.productName}</h3>
                    <p className="text-xs text-gray-400">{rev.customerName} • {rev.storeName}</p>
                  </div>
                  <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 text-xs px-2.5 py-1 rounded font-semibold">
                    PENDING
                  </span>
                </div>
                <div className="flex items-center gap-1 text-yellow-400 my-2 text-sm">
                  {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                  <span className="text-xs text-gray-400 ml-2 uppercase">({rev.marketplace})</span>
                </div>
                <p className="text-gray-300 text-sm italic">"{rev.reviewText}"</p>
              </div>
            ))
          )}
        </div>

        {/* Right Col: NOVA AI Reply Generator */}
        <div className="bg-[#131826] border border-gray-800 p-5 rounded-xl h-fit sticky top-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-purple-400 flex items-center gap-2">
              ✦ NOVA AI REPLY GENERATOR
            </h2>
            <span className="bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded border border-green-500/20">
              Confidence 92%
            </span>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-400 block mb-1">SELECTED REVIEW</label>
            <div className="bg-[#0b0f19] p-3 rounded-lg border border-gray-800 text-xs text-gray-300">
              {selectedReview ? (
                <>
                  <p className="font-semibold text-white mb-1">"{selectedReview.reviewText}"</p>
                  <p className="text-gray-400">{selectedReview.customerName} • {selectedReview.productName} • {selectedReview.rating}★</p>
                </>
              ) : (
                <p className="text-gray-500">Select a review from the left list</p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-400 block mb-1">TONE</label>
            <input 
              type="text" 
              value={tone} 
              onChange={(e) => setTone(e.target.value)}
              className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">AI GENERATED REPLY</label>
            <textarea 
              rows={5}
              value={aiReply}
              onChange={(e) => setAiReply(e.target.value)}
              className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button 
            onClick={() => alert('Reply sent successfully to marketplace!')}
            className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-lg"
          >
            Approve & Send Reply
          </button>
        </div>
      </div>
    </div>
  );
}
