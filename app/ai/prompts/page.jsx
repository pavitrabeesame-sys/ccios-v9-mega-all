// app/ai/prompts/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function PromptLibraryPage() {
  const [prompts, setPrompts] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("REVIEW_REPLY");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userTemplate, setUserTemplate] = useState("");

  // Variable Preview Sandbox
  const [testVars, setTestVars] = useState({
    customerName: "Alex",
    productName: "Leather Wallet",
    rating: "5",
    reviewText: "Great craftsmanship and durable leather!",
    brandName: "OBERMAIN",
  });

  useEffect(() => {
    fetchPrompts();
  }, []);

  async function fetchPrompts() {
    try {
      setLoading(true);
      const res = await fetch("/api/ai/prompts");
      const data = await res.json();
      if (data.prompts) {
        setPrompts(data.prompts);
        selectTemplate(data.prompts[0]);
      }
    } catch (err) {
      alert(`Error loading prompts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function selectTemplate(template) {
    if (!template) return;
    setSelectedPrompt(template);
    setTitle(template.title);
    setCategory(template.category);
    setDescription(template.description);
    setSystemPrompt(template.systemPrompt);
    setUserTemplate(template.userTemplate);
  }

  function renderCompiledUserPrompt() {
    let output = userTemplate || "";
    Object.keys(testVars).forEach((key) => {
      const placeholder = new RegExp(`\\{${key}\\}`, "g");
      output = output.replace(placeholder, testVars[key]);
    });
    return output;
  }

  async function handleSavePrompt(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/ai/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPrompt?.id,
          title,
          category,
          description,
          systemPrompt,
          userTemplate,
        }),
      });

      if (!res.ok) throw new Error("Failed to save template");

      const result = await res.json();
      alert("🚀 Prompt Template updated successfully!");
      fetchPrompts();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 font-medium">
        Loading Prompt Library...
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
            Prompt Template Library
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage system prompts, response logic, and variable bindings for NOVA AI.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List Column */}
        <div className="bg-white border rounded-xl p-4 shadow space-y-3">
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
            Prompt Templates
          </h2>
          <div className="space-y-2">
            {prompts.map((p) => (
              <button
                key={p.id}
                onClick={() => selectTemplate(p)}
                className={`w-full text-left p-3 rounded-lg text-xs transition-colors border ${
                  selectedPrompt?.id === p.id
                    ? "bg-blue-50 border-blue-300 text-blue-900 font-semibold"
                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold">{p.title}</span>
                  <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-mono">
                    {p.category}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Editor & Preview Panel */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSavePrompt} className="bg-white border rounded-xl p-6 shadow space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border p-2.5 text-xs rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-50 border p-2.5 text-xs rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="REVIEW_REPLY">Review Reply</option>
                  <option value="CUSTOMER_SERVICE">Customer Service Escalation</option>
                  <option value="MARKETING">Marketing & Chat Broadcast</option>
                  <option value="GENERAL">General Prompt</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                System Prompt (AI Instruction & Persona Constraints)
              </label>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-slate-50 border p-2.5 text-xs font-mono rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                User Prompt Template (Use placeholders: &#123;customerName&#125;, &#123;productName&#125;, &#123;rating&#125;, &#123;reviewText&#125;, &#123;brandName&#125;)
              </label>
              <textarea
                rows={3}
                value={userTemplate}
                onChange={(e) => setUserTemplate(e.target.value)}
                className="w-full bg-slate-50 border p-2.5 text-xs font-mono rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Variable Interpolation Live Preview */}
            <div className="bg-slate-900 rounded-lg p-4 text-xs font-mono text-emerald-400 space-y-2 border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                Live Variable Injection Preview:
              </div>
              <div className="text-slate-200 bg-slate-950 p-2.5 rounded border border-slate-800">
                {renderCompiledUserPrompt()}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium text-xs px-5 py-2.5 rounded-lg transition-colors shadow"
              >
                {saving ? "Saving..." : "Save Prompt Template"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}