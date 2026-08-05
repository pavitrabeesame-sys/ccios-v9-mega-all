// app/ai/knowledge/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function KnowledgeBasePage() {
  const [brands, setBrands] = useState([]);
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form input state
  const [category, setCategory] = useState("RETURN_POLICY");
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [currentKBText, setCurrentKBText] = useState("");

  useEffect(() => {
    fetchKnowledgeBaseList();
  }, []);

  async function fetchKnowledgeBaseList() {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/knowledge");
      if (!res.ok) throw new Error("Failed to load Knowledge Base list");
      const data = await res.json();
      setBrands(data);

      if (data.length > 0) {
        setSelectedBrandId(data[0].brandId);
        setCurrentKBText(data[0].knowledgeBase);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleBrandSelect(brandId) {
    setSelectedBrandId(brandId);
    const target = brands.find((b) => b.brandId === brandId);
    if (target) {
      setCurrentKBText(target.knowledgeBase);
    }
  }

  async function handleAddDocument(e) {
    e.preventDefault();
    if (!docContent.trim()) {
      alert("Please enter document content.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ai/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: selectedBrandId,
          category,
          title: docTitle,
          content: docContent,
        }),
      });

      if (!res.ok) throw new Error("Failed to save knowledge document");

      const result = await res.json();
      setCurrentKBText(result.knowledgeBase);

      // Reset form
      setDocTitle("");
      setDocContent("");
      alert("🚀 Knowledge Document successfully injected into AI Profile!");
      fetchKnowledgeBaseList();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading Brand Knowledge Repositories...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <Link href="/ai" className="text-xs text-blue-600 hover:underline block mb-1">
            &larr; Back to AI Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            Brand Knowledge Base System (SOP & Rules Repository)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Inject SOPs, Return Policies, Sizing Charts, and FAQ context into NOVA AI.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Brand Selector Side Column */}
        <div className="bg-white border rounded-xl p-4 shadow space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Select Brand Brain
          </h2>
          <div className="space-y-1">
            {brands.map((b) => (
              <button
                key={b.brandId}
                onClick={() => handleBrandSelect(b.brandId)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex justify-between items-center ${
                  selectedBrandId === b.brandId
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{b.brandName}</span>
                <span className="text-xs text-slate-400 font-mono">{b.brandCode}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Knowledge Editor & Viewer Main Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add New Knowledge Form */}
          <form
            onSubmit={handleAddDocument}
            className="bg-white border rounded-xl p-6 shadow space-y-4"
          >
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Inject New Knowledge Module
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Document Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border p-2.5 text-xs rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="RETURN_POLICY">Return & Refund Policy</option>
                  <option value="WARRANTY_SOP">Warranty & Repair SOP</option>
                  <option value="CARE_GUIDE">Product Care & Material Maintenance</option>
                  <option value="SIZE_CHART">Sizing & Fitting Index</option>
                  <option value="SHIPPING_SLA">Shipping & Fulfillment SLA</option>
                  <option value="FAQ">Frequently Asked Questions</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Module Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Genuine Leather 1-Year Craftsmanship Warranty"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  className="w-full bg-slate-50 border p-2.5 text-xs rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                SOP Content / Policy Rules
              </label>
              <textarea
                rows={4}
                placeholder="Enter exact rules or information the AI must refer to when generating replies..."
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                className="w-full bg-slate-50 border p-2.5 text-xs font-mono rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium text-xs px-5 py-2.5 rounded-lg transition-colors shadow"
              >
                {saving ? "Injecting..." : "+ Append Module to AI Profile"}
              </button>
            </div>
          </form>

          {/* Active Knowledge Base View */}
          <div className="bg-white border rounded-xl p-6 shadow space-y-3">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Active Knowledge Base Memory Stream
            </h2>
            <textarea
              readOnly
              rows={10}
              value={currentKBText || "No context documents uploaded."}
              className="w-full bg-slate-900 text-green-400 p-4 text-xs font-mono rounded-lg border border-slate-800 focus:outline-none"
            />
          </div>
        </div>
      </div>
      
    </div>

  );

}