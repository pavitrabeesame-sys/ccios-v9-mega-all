'use client';

import React, { useState, useEffect } from 'react';

const BRANDS = ['ALL', 'RAV', 'NICOLE', 'OBERMAIN', 'HUSH', 'BHPC'];
const PLATFORMS = ['All', 'Shopee', 'Lazada'];
const STATUSES = ['ALL', 'Pending', 'Approved', 'Replied', 'Rejected'];

export default function ReviewsDashboard() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('ALL');
  const [selectedPlatform, setSelectedPlatform] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReview, setActiveReview] = useState(null);
  const [aiReplyText, setAiReplyText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [actionMessage, setActionMessage] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBrand !== 'ALL') params.append('brand', selectedBrand);
      if (selectedPlatform !== 'All') params.append('platform', selectedPlatform);
      if (selectedStatus !== 'ALL') params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);

      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setReviews(data.reviews || []);
        if (data.reviews.length > 0 && !activeReview) {
          setActiveReview(data.reviews[0]);
          setAiReplyText(data.reviews[0]?.aiReply || '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [selectedBrand, selectedPlatform, selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReviews();
  };

  const handleGenerateAiReply = async (review) => {
    if (!review) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: review.id, brand: review.brand, text: review.reviewText || review.comment })
      });
      const data = await res.json();
      if (data.success) {
        setAiReplyText(data.reply);
      } else {
        setAiReplyText(`Thank you for supporting ${review.brand}! We appreciate your feedback.`);
      }
    } catch (err) {
      setAiReplyText(`Thank you for supporting ${review.brand}! We appreciate your feedback.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAndReply = async () => {
    if (!activeReview) return;
    setActionMessage('Posting reply to marketplace API...');
    try {
      const res = await fetch('/api/reviews/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId: activeReview.id, replyText: aiReplyText })
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage('✅ Reply successfully posted to marketplace!');
        fetchReviews();
      } else {
        setActionMessage(`❌ Error: ${data.error || 'Failed to reply'}`);
      }
    } catch (err) {
      setActionMessage('❌ Network error while posting reply.');
    }
  };

  return (
    <div className="flex h-screen bg-[#0a090e] text-[#e2dfd8] font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0e0d13] border-r border-[#1f1d2b] flex flex-col justify-between hidden md:flex select-none">
        <div>
          <div className="p-6 border-b border-[#1f1d2b]">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-bold tracking-widest text-[#f3efe6]">CCIOS V9</h1>
              <span className="flex items-center text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span> LIVE
              </span>
            </div>
            <p className="text-[10px] text-[#8c8896] uppercase tracking-wider mt-0.5">Final Core</p>
          </div>

          <nav className="p-4 space-y-1 text-xs font-medium">
            <a href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Today</a>
            <a href="/brands" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Brands</a>
            <a href="/products" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Products</a>
            <a href="/orders" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Orders</a>
            
            <a href="/reviews" className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#1a1824] border border-[#2d2a3d] text-[#f3efe6]">
              <span>Reviews ❤️</span>
              <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.2 rounded-full font-bold">15</span>
            </a>

            <a href="/customers" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Customers</a>
            <a href="/inventory" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Inventory</a>
            <a href="/campaigns" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Campaigns</a>
            
            <div className="pt-2 pb-1">
              <a href="/visual-commerce" className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">
                <span>Visual Commerce</span>
                <span className="bg-cyan-500/10 text-cyan-400 text-[9px] px-1.5 py-0.2 rounded uppercase font-bold">New</span>
              </a>
            </div>

            <a href="/health-score" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Health Score</a>
            <a href="/action-centre" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Action Centre</a>
            <a href="/nova" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">NOVA AI</a>
            <a href="/analytics" className="block px-3 py-2 rounded-lg hover:bg-[#1a1824] text-[#8c8896] hover:text-[#f3efe6] transition-colors">Analytics</a>
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 border-t border-[#1f1d2b] flex items-center justify-between bg-[#0a090e]">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-xs">
              P
            </div>
            <div>
              <p className="text-xs font-bold text-[#f3efe6]">Pavi</p>
              <p className="text-[10px] text-[#8c8896]">Owner • 4 Brands</p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        </div>
      </aside>

      {/* Main Review Dashboard Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0d0c11]">
        
        {/* Top Header Banner */}
        <header className="bg-[#0e0d13] border-b border-[#1f1d2b] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-serif tracking-wide text-[#f3efe6] flex items-center space-x-2">
              <span>Reviews</span>
              <span className="text-sm font-sans text-[#8c8896]">— Heart of System</span>
            </h2>
            <p className="text-[11px] text-[#8c8896] mt-0.5">AI Fetch • Reply • From Day 1 • NOVA summary • Reply Comment API</p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-[#14121d] border border-[#232030] px-3 py-1.5 rounded-lg text-xs">
              <span className="text-[#8c8896] mr-2">Reply Rate</span>
              <span className="font-bold text-emerald-400">94%</span>
            </div>
            <div className="bg-[#14121d] border border-[#232030] px-3 py-1.5 rounded-lg text-xs">
              <span className="text-[#8c8896] mr-2">Avg</span>
              <span className="font-bold text-amber-400">4.8★</span>
            </div>
            <div className="bg-[#14121d] border border-[#232030] px-3 py-1.5 rounded-lg text-xs">
              <span className="text-[#8c8896] mr-2">Pending</span>
              <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">15</span>
            </div>
          </div>
        </header>

        {/* Filter Pills Bar */}
        <div className="bg-[#0e0d13]/60 border-b border-[#1f1d2b] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2 overflow-x-auto py-1">
            {BRANDS.map((brand) => (
              <button
                key={brand}
                onClick={() => setSelectedBrand(brand)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedBrand === brand 
                    ? 'bg-[#262335] text-[#f3efe6] border border-[#3b374f]' 
                    : 'bg-[#14121d] text-[#8c8896] hover:text-[#f3efe6] border border-transparent'
                }`}
              >
                {brand} {brand === 'ALL' ? '(15)' : ''}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {PLATFORMS.map((plat) => (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedPlatform === plat 
                    ? 'bg-[#262335] text-[#f3efe6] border border-[#3b374f]' 
                    : 'bg-[#14121d] text-[#8c8896] hover:text-[#f3efe6] border border-transparent'
                }`}
              >
                {plat}
              </button>
            ))}
          </div>
        </div>

        {/* Main Split Interface */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Feed Table */}
          <div className="w-full md:w-7/12 border-r border-[#1f1d2b] overflow-y-auto p-6 space-y-3">
            <div className="grid grid-cols-12 text-[11px] font-semibold text-[#8c8896] uppercase tracking-wider pb-2 border-b border-[#1f1d2b] px-2">
              <div className="col-span-5">Product</div>
              <div className="col-span-2">Rating</div>
              <div className="col-span-2">Brand</div>
              <div className="col-span-3 text-right">Status</div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-[#8c8896] text-xs">Synchronizing live reviews from marketplace APIs...</div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-20 text-[#8c8896] text-xs">No reviews found matching filter parameters.</div>
            ) : (
              reviews.map((rev) => (
                <div
                  key={rev.id}
                  onClick={() => {
                    setActiveReview(rev);
                    setAiReplyText(rev.aiReply || '');
                    setActionMessage('');
                  }}
                  className={`grid grid-cols-12 items-center p-3 rounded-xl border cursor-pointer transition-all ${
                    activeReview?.id === rev.id
                      ? 'bg-[#171520] border-[#3b374f] shadow-lg shadow-black/40'
                      : 'bg-[#121118]/80 border-[#1f1d2b] hover:border-[#2d2a3d]'
                  }`}
                >
                  <div className="col-span-5 pr-2">
                    <h4 className="text-xs font-bold text-[#f3efe6] truncate">{rev.productName || rev.sku}</h4>
                    <p className="text-[11px] text-[#8c8896] truncate mt-0.5">{rev.customerName || 'Verified Buyer'}</p>
                  </div>

                  <div className="col-span-2 text-amber-400 text-xs">
                    {'★'.repeat(rev.rating || 5)}
                  </div>

                  <div className="col-span-2">
                    <span className="text-[11px] font-semibold text-[#f3efe6] block">{rev.brand || 'RAV'}</span>
                    <span className="text-[10px] text-[#8c8896]">{rev.marketplace || 'Shopee'}</span>
                  </div>

                  <div className="col-span-3 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      rev.status === 'Replied' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {rev.status || 'Pending'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right NOVA AI Generator Panel */}
          <div className="hidden md:flex flex-1 flex-col bg-[#100e16] overflow-y-auto p-6">
            {activeReview ? (
              <div className="max-w-lg mx-auto w-full space-y-5">
                
                {/* NOVA AI Header */}
                <div className="bg-[#14121d] border border-[#2b273b] rounded-xl p-5 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">NOVA AI REPLY GENERATOR</span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      Confidence 92%
                    </span>
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] text-[#8c8896] uppercase tracking-wider mb-1">Selected Review</p>
                    <p className="text-xs text-[#f3efe6] italic bg-[#0a090e] p-3 rounded-lg border border-[#1f1d2b]">
                      "{activeReview.reviewText || activeReview.comment || 'Kasut kulit sangat cantik kualiti premium'}"
                    </p>
                    <p className="text-[10px] text-[#8c8896] mt-1.5">{activeReview.customerName || 'Zaki Rahman'} • {activeReview.productName || 'RAV Bifold Wallet MB-001'} • {activeReview.rating || 5}★</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-[10px] text-[#8c8896] uppercase tracking-wider mb-2">Tone</p>
                    <div className="flex items-center space-x-2">
                      <div className="bg-[#1a1824] border border-[#302c42] px-3 py-1.5 rounded-lg text-xs">
                        <span className="font-bold text-amber-400 mr-2">{activeReview.brand || 'RAV'}</span>
                        <span className="text-[#8c8896]">Artisan rugged warm</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-[#8c8896] uppercase tracking-wider mb-1">AI Generated Reply</p>
                    <textarea
                      rows={5}
                      value={aiReplyText}
                      onChange={(e) => setAiReplyText(e.target.value)}
                      className="w-full bg-[#0a090e] border border-[#232030] rounded-lg p-3 text-xs text-[#f3efe6] focus:outline-none focus:border-cyan-500/80 leading-relaxed"
                    />
                  </div>

                  {actionMessage && (
                    <div className="mt-3 p-2.5 rounded-lg bg-[#0a090e] border border-[#232030] text-xs text-cyan-300 font-medium">
                      {actionMessage}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#1f1d2b]">
                    <button
                      onClick={() => handleGenerateAiReply(activeReview)}
                      disabled={generating}
                      className="text-xs text-[#8c8896] hover:text-[#f3efe6] transition-colors disabled:opacity-50"
                    >
                      {generating ? 'Regenerating...' : '↺ Regenerate'}
                    </button>

                    <button
                      onClick={handleApproveAndReply}
                      className="px-4 py-2 bg-[#f3efe6] hover:bg-white text-slate-950 font-bold text-xs rounded-lg shadow-md transition-all flex items-center space-x-1.5"
                    >
                      <span>Approve & Reply (Reply Comment API)</span>
                    </button>
                  </div>
                </div>

                <p className="text-[10px] text-center text-[#8c8896] px-4">
                  Auto-fetch via Shopee/Lazada Review List API • AI tone matching brand guidelines • Premium luxury no cheap templates
                </p>

              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#8c8896] text-xs">
                Select a review from the list to view NOVA AI generator options.
              </div>
            )}
          </div>

        </div>

      </main>
    </div>
  );
}