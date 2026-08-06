'import client side if using interactivity, or standard server component'
import React from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  ShoppingCart, 
  MessageSquare, 
  Users, 
  Boxes, 
  Megaphone, 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  Bot, 
  BarChart3, 
  ArrowUpRight, 
  RefreshCw, 
  CheckCircle2,
  Clock,
  ChevronRight
} from 'lucide-react';

export default function HomeDashboard() {
  return (
    <div className="flex min-h-screen bg-[#0a0b0e] text-slate-100 font-sans selection:bg-amber-500 selection:text-black">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0e0f13] border-r border-slate-800/60 flex flex-col justify-between fixed h-screen z-20">
        <div>
          {/* Logo Header */}
          <div className="p-6 border-b border-slate-800/60 flex items-center justify-between">
            <div>
              <h1 className="font-bold tracking-wider text-sm text-slate-200">CCIOS V9</h1>
              <p className="text-[10px] tracking-widest text-amber-500/90 font-semibold uppercase">Final Core</p>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              LIVE
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 text-xs">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-transparent border border-amber-500/30 text-amber-400 font-medium">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="w-4 h-4 text-amber-400" />
                <span>TODAY</span>
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <Store className="w-4 h-4" />
              <span>BRANDS</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <Package className="w-4 h-4" />
              <span>PRODUCTS</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <ShoppingCart className="w-4 h-4" />
              <span>ORDERS</span>
            </div>

            {/* ACTIVE REVIEWS LINK */}
            <Link href="/reviews" className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-200 hover:bg-slate-800/60 transition group">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
                <span className="font-medium">REVIEWS</span>
              </div>
              <span className="bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">15</span>
            </Link>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <Users className="w-4 h-4" />
              <span>CUSTOMERS</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <Boxes className="w-4 h-4" />
              <span>INVENTORY</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <Megaphone className="w-4 h-4" />
              <span>CAMPAIGNS</span>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4" />
                <span>VISUAL COMMERCE</span>
              </div>
              <span className="bg-amber-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded">NEW</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <Activity className="w-4 h-4" />
              <span>HEALTH SCORE</span>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4" />
                <span>ACTION CENTRE</span>
              </div>
              <span className="bg-rose-500/20 text-rose-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">9</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <Bot className="w-4 h-4" />
              <span>NOVA AI</span>
            </div>

            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 transition">
              <BarChart3 className="w-4 h-4" />
              <span>ANALYTICS</span>
            </div>
          </nav>
        </div>

        {/* User Profile Card at Bottom */}
        <div className="p-4 m-3 bg-[#13141a] border border-slate-800/80 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-black font-bold text-sm shadow-md">
              P
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Pavi</p>
              <p className="text-[10px] text-slate-400">Owner • 4 Brands</p>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 ml-64 p-8 bg-[#0a0b0e]">
        
        {/* Top Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/60">
          <div>
            <h2 className="text-3xl font-serif text-amber-100 tracking-wide">Good Morning, Pavi</h2>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              Tuesday, 9:00 AM 
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="text-slate-300 font-medium">Intelligence Brief</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300 ml-2">2 brands online</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] text-slate-300">4 connected</span>
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#13141a] border border-slate-800 rounded-xl text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE SYNC</span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">Updated 12s ago</span>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black text-xs font-bold rounded-xl shadow-lg shadow-amber-500/10 transition">
              <Sparkles className="w-3.5 h-3.5" />
              Ask NOVA
            </button>
          </div>
        </div>

        {/* METRICS GRID ROW 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          
          {/* Card 1: New Orders */}
          <div className="bg-[#13141a] border border-slate-800/80 rounded-2xl p-5 relative group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition">
                View <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-1">32 new orders</h3>
            <p className="text-xs text-slate-400">RAV 5 • Nicole 12 • Hush 10 • Luxe 5</p>
          </div>

          {/* Card 2: Out of Stock */}
          <div className="bg-[#13141a] border border-slate-800/80 rounded-2xl p-5 relative group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Boxes className="w-4 h-4" />
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition">
                Restock <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-1">8 out of stock</h3>
            <p className="text-xs text-slate-400">RAV Bifold MB-001, Card Holder etc</p>
          </div>

          {/* Card 3: Reviews Waiting (Links to reviews page) */}
          <Link href="/reviews" className="bg-[#13141a] border border-slate-800/80 rounded-2xl p-5 relative group hover:border-amber-500/50 transition block">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <span className="text-xs text-amber-400 group-hover:underline flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg font-medium">
                Generate <ArrowUpRight className="w-3 h-3" />
              </span>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-1">15 reviews waiting</h3>
            <p className="text-xs text-slate-400">AI reply • 9 Shopee • 6 Lazada</p>
          </Link>

        </div>

        {/* METRICS GRID ROW 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          
          {/* Card 4: Campaigns Ending */}
          <div className="bg-[#13141a] border border-slate-800/80 rounded-2xl p-5 relative group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Megaphone className="w-4 h-4" />
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition">
                Manage <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-1">5 campaigns ending</h3>
            <p className="text-xs text-slate-400">7.7 Sale ends in 4h 21m</p>
          </div>

          {/* Card 5: Products Failed */}
          <div className="bg-[#13141a] border border-slate-800/80 rounded-2xl p-5 relative group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition">
                Retry <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-1">3 products failed</h3>
            <p className="text-xs text-slate-400">Publish failed • Shopee API limit</p>
          </div>

          {/* Card 6: Yesterday Revenue */}
          <div className="bg-[#13141a] border border-slate-800/80 rounded-2xl p-5 relative group hover:border-slate-700 transition">
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800/50 hover:bg-slate-800 px-2.5 py-1 rounded-lg transition">
                Analytics <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-1">Yesterday RM12,540</h3>
            <p className="text-xs text-emerald-400 font-medium">+18% vs prev • Sparkline simulation</p>
          </div>

        </div>

        {/* NOVA RECOMMENDATION BANNER */}
        <div className="bg-gradient-to-r from-[#171612] via-[#13141a] to-[#13141a] border border-amber-500/30 rounded-2xl p-6 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-400 tracking-wider">NOVA RECOMMENDATION</span>
                <span className="bg-rose-500/20 text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full">HIGH IMPACT</span>
              </div>
              <h4 className="text-base font-semibold text-slate-100">Restock RAV Bifold MB-001 — Sales +42% in 3 days, 3 days stock left</h4>
              <p className="text-xs text-slate-400 mt-1">Demand spike detected from 7.7 campaign. Forecasted sell-out by Thu. Creating PO now preserves RM4.2k revenue. Supplier lead time 5 days.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
            <button className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition shadow-lg shadow-amber-500/10">
              Create PO
            </button>
            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition">
              View Trend
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}