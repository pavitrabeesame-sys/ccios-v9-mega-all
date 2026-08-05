"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AIBrandProfileEditorPage({ params }) {
  const { id } = params;

  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form State
  const [model, setModel] = useState("qwen3:4b");
  const [tone, setTone] = useState("Professional");
  const [personality, setPersonality] = useState("");
  const [brandRules, setBrandRules] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  const [replyStyle, setReplyStyle] = useState("");
  const [knowledgeBase, setKnowledgeBase] = useState("");

  useEffect(() => {
    async function fetchBrandProfile() {
      try {
        setLoading(true);
        const res = await fetch(`/api/ai/brands/${id}`);
        if (!res.ok) throw new Error(`Error ${res.status}: Profile not found`);

        const data = await res.json();
        setBrand(data);

        if (data.aiProfile) {
          const p = data.aiProfile;
          setModel(p.model || "qwen3:4b");
          setTone(p.tone || "Professional");
          setPersonality(p.personality || "");
          setBrandRules(p.brandRules || "");
          setForbiddenWords(
            Array.isArray(p.forbiddenWords) ? p.forbiddenWords.join(", ") : ""
          );
          setReplyStyle(p.replyStyle || "");
          setKnowledgeBase(p.knowledgeBase || "");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (id) fetchBrandProfile();
  }, [id]);

  async function saveProfile(e) {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/ai/brands/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          tone,
          personality,
          brandRules,
          forbiddenWords,
          replyStyle,
          knowledgeBase,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to save AI Profile");
      }

      alert("🚀 AI Profile Saved to Database!");
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Loading AI Brain...</div>;
  if (error || !brand) return <div className="p-8 text-center text-red-500">{error || "Brand not found"}</div>;

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <Link href="/ai/brands" className="text-xs text-blue-600 hover:underline mb-1 block">
            &larr; Back to AI Brands
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            {brand.name} <span className="text-xs font-normal text-slate-500">[{brand.code}]</span>
          </h1>
        </div>

        <button
          onClick={saveProfile}
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium px-5 py-2.5 rounded-lg shadow"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      <form onSubmit={saveProfile} className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow border space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase">1. Core AI Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">AI Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-slate-50 border p-2.5 text-sm rounded-lg">
                <option value="qwen3:4b">qwen3:4b (Local)</option>
                <option value="llama3">llama3</option>
                <option value="gpt-4o">gpt-4o</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full bg-slate-50 border p-2.5 text-sm rounded-lg">
                <option value="Professional">Professional</option>
                <option value="Rugged Premium">Rugged Premium</option>
                <option value="Luxury">Luxury</option>
                <option value="Sporty">Sporty</option>
                <option value="Friendly">Friendly</option>
                <option value="Elegant">Elegant</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Personality</label>
            <input type="text" value={personality} onChange={(e) => setPersonality(e.target.value)} className="w-full bg-slate-50 border p-2.5 text-sm rounded-lg" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase">2. Rules & Guardrails</h2>
          <div>
            <label className="block text-xs font-semibold mb-1">Brand Rules</label>
            <textarea rows={3} value={brandRules} onChange={(e) => setBrandRules(e.target.value)} className="w-full bg-slate-50 border p-2.5 text-xs font-mono rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Forbidden Words (comma-separated)</label>
            <input type="text" value={forbiddenWords} onChange={(e) => setForbiddenWords(e.target.value)} className="w-full bg-slate-50 border p-2.5 text-sm rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Reply Style</label>
            <input type="text" value={replyStyle} onChange={(e) => setReplyStyle(e.target.value)} className="w-full bg-slate-50 border p-2.5 text-sm rounded-lg" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border space-y-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase">3. Knowledge Base</h2>
          <div>
            <label className="block text-xs font-semibold mb-1">SOP Guidelines & Context</label>
            <textarea rows={4} value={knowledgeBase} onChange={(e) => setKnowledgeBase(e.target.value)} className="w-full bg-slate-50 border p-2.5 text-xs font-mono rounded-lg" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium px-6 py-2.5 rounded-lg shadow">
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </form>
    </div>
  );
}