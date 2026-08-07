'use client';

import { useState, useEffect } from 'react';
import { Star, Sparkles, CheckCircle, RefreshCw, Search } from 'lucide-react';

export default function ReviewDashboard() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedMarketplace, setSelectedMarketplace] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [replyText, setReplyText] = useState('');
  const [syncing, setSyncing] = useState(false);

  const brandMapping: Record<string, string> = {
    'RAV': 'RAV',
    'NICOLE': 'Nicole',
    'OBERMAIN': 'Obermain',
    'HUSH': 'Hush Puppies',
    'BHPC': 'Beverly Hills Polo Club'
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBrand !== 'ALL') {
        params.append('brand', brandMapping[selectedBrand] || selectedBrand);
      }
      if (selectedMarketplace !== 'ALL') {
        params.append('marketplace', selectedMarketplace);
      }
      if (selectedStatus !== 'ALL') {
        params.append('status', selectedStatus);
      }

      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();
      const list = data.reviews || data || [];
      setReviews(list);
      
      if (list.length > 0 && (!selectedReview || !list.find((r: any) => (r.id || r.reviewId) === (selectedReview.id || selectedReview.reviewId)))) {
        setSelectedReview(list[0]);
        setReplyText(`Thank you for your wonderful feedback, ${list[0].customerName || 'valued customer'}! We're thrilled you love your new item.`);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncLiveReviews = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/reviews/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully synced ${data.syncedCount} live reviews! (Shopee: ${data.breakdown.shopee}, Lazada: ${data.breakdown.lazada})`);
        fetchReviews();
      } else {
        alert(`Sync failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to live sync API.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [selectedBrand, selectedMarketplace, selectedStatus]);

  const filteredReviews = reviews.filter((r) => {
    const matchesSearch = 
      r.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.reviewText?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleApproveAndReply = async () => {
    if (!selectedReview) return;
    try {
      const res = await fetch(`/api/reviews/${selectedReview.id || selectedReview.reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyText, status: 'APPROVED' })
      });
      if (res.ok) {
        alert('Review approved and reply sent successfully!');
        fetchReviews();
      } else {
        alert('Failed to process review action.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating review.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-gray-100 p-6 flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">Reviews</h1>
            <span className="text-gray-500">— Heart of System</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">AI Fetch • Reply • From Day 1 • NOVA summary • Reply Comment API</p>
        </div>
        
        {/* Metric Badges */}
        <div className="flex items-center gap-3">
          <div className="bg-[#111827] border border-gray-800 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <span className="text-gray-400">Reply Rate</span>
            <span className="font-bold text-emerald-400">94%</span>
          </div>
          <div className="bg-[#111827] border border-gray-800 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <span className="text-gray-400">Avg</span>
            <span className="font-bold text-amber-400">4.8 ★</span>
          </div>
          <div className="bg-[#111827] border border-gray-800 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2">
            <span className="text-gray-400">Pending</span>
            <span className="font-bold text-amber-500">{reviews.filter((r) => r.status === 'PENDING').length}</span>
          </div>

          <button 
            onClick={handleSyncLiveReviews}
            disabled={syncing}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-blue-600/20"
            title="Sync Live Reviews from Shopee & Lazada APIs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing APIs...' : 'Sync Live Reviews'}
          </button>

          <button 
            onClick={fetchReviews}
            className="p-2 bg-[#1f2937] hover:bg-[#374151] rounded-lg text-gray-300 transition"
            title="Refresh Reviews"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Navigation Row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#111827]/50 p-4 rounded-xl border border-gray-800">
        {/* Brand Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {['ALL', 'RAV', 'NICOLE', 'OBERMAIN', 'HUSH', 'BHPC'].map((b) => (
            <button
              key={b}
              onClick={() => setSelectedBrand(b)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                selectedBrand === b
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-[#1f2937] text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
            >
              {b === 'ALL' ? `ALL (${reviews.length})` : b}
            </button>
          ))}
        </div>

        {/* Marketplace & Status Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-[#1f2937] p-1 rounded-lg">
            {['ALL', 'SHOPEE', 'LAZADA'].map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMarketplace(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  selectedMarketplace === m ? 'bg-gray-900 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex bg-[#1f2937] p-1 rounded-lg">
            {['ALL', 'PENDING', 'APPROVED'].map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                  selectedStatus === s ? 'bg-amber-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left 2 Columns: Review Feed */}
        <div className="lg:col-span-2 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Search products, customers, or review text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-[#111827] border border-gray-800 rounded-xl text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-500 bg-[#111827] rounded-xl border border-gray-800 animate-pulse">
              Loading reviews from database...
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="p-12 text-center text-gray-500 bg-[#111827] rounded-xl border border-gray-800">
              No reviews found matching your filters.
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              {filteredReviews.map((r) => {
                const isSelected = selectedReview && (selectedReview.id === r.id || selectedReview.reviewId === r.reviewId);
                return (
                  <div
                    key={r.id || r.reviewId}
                    onClick={() => {
                      setSelectedReview(r);
                      const comment = r.reviewText ? r.reviewText.toLowerCase() : '';
                      let contextualMsg = `Thank you so much for your wonderful support, ${r.customerName || 'valued customer'}!`;
                      
                      if (comment.includes('pocket')) {
                        contextualMsg = `Thank you for the fantastic feedback, ${r.customerName || 'valued customer'}! We're so glad you love the functional pockets on your new ${r.brand || 'Nicole'} piece. Enjoy!`;
                      } else if (comment.includes('quality') || comment.includes('material')) {
                        contextualMsg = `Thank you, ${r.customerName || 'valued customer'}! We take great pride in our material quality at ${r.brand || 'Nicole'}. Glad you love it!`;
                      } else {
                        contextualMsg = `Thank you for your support, ${r.customerName || 'valued customer'}! We appreciate your feedback on your ${r.brand || 'Nicole'} purchase.`;
                      }
                      
                      setReplyText(contextualMsg);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      isSelected 
                        ? 'bg-[#1e293b] border-blue-500 shadow-lg shadow-blue-500/10' 
                        : 'bg-[#111827] border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-200">{r.productName}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{r.customerName} • <span className="text-blue-400">{r.storeName || r.brand}</span></p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        r.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 my-2 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < (r.rating || 5) ? 'fill-current' : 'text-gray-700'}`} />
                      ))}
                      <span className="text-xs text-gray-400 ml-1 font-mono">({r.marketplace})</span>
                    </div>

                    <p className="text-xs text-gray-300 line-clamp-2 mt-1 italic">"{r.reviewText || 'No comment text provided.'}"</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: NOVA AI Sidebar */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5 sticky top-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400 animate-pulse" />
              <h3 className="font-bold text-sm text-white tracking-wide">NOVA AI REPLY GENERATOR</h3>
            </div>
            <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Confidence 92%
            </span>
          </div>

          {selectedReview ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Selected Review</span>
                <div className="mt-1 p-3 bg-[#090d16] rounded-xl border border-gray-800 text-xs text-gray-300 italic">
                  "{selectedReview.reviewText || 'No comment'}"
                  <div className="text-[10px] text-gray-500 mt-2 not-italic font-mono">
                    {selectedReview.customerName} • {selectedReview.productName} • {selectedReview.rating}★
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Tone</span>
                <div className="mt-1 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-amber-950/60 border border-amber-800/80 text-amber-300 text-xs font-medium">
                    {selectedReview.brand || 'Brand'} Artisan rugged warm
                  </span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">AI Generated Reply</span>
                  <button 
                    onClick={() => setReplyText(`Thank you so much for your support! We are glad you love your purchase from ${selectedReview.brand}. Let us know if you need anything else!`)}
                    className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Regenerate
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="w-full p-3 bg-[#090d16] border border-gray-800 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <button
                onClick={handleApproveAndReply}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Approve & Reply (Reply Comment API)
              </button>
            </div>
          ) : (
            <div className="py-16 text-center text-gray-500 text-xs">
              Select a review from the list on the left to generate an AI response.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}