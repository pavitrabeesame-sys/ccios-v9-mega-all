// app/ai/brands/page.jsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function AIBrandsPage() {

  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/ai/brands")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBrands(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch brands:", err);
        setLoading(false);
      });
  }, []);
  

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Brand Profiles</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage multi-brand AI brains, tones, rules, and SOP guardrails.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden border border-slate-200">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600 font-semibold">
            <tr>
              <th className="p-4 border-b">Brand</th>
              <th className="p-4 border-b">Store</th>
              <th className="p-4 border-b">Model</th>
              <th className="p-4 border-b">Tone</th>
              <th className="p-4 border-b">Status</th>
              <th className="p-4 border-b text-right">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  Loading AI Brand Profiles...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  No brands found in database.
                </td>
              </tr>
            ) : (
              brands.map((brand) => (
                <tr key={brand.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-semibold text-slate-900">
                    {brand.name}
                  </td>
                  <td className="p-4 text-slate-500 font-mono text-xs">
                    {brand.code.toLowerCase()}.os
                  </td>
                  <td className="p-4 font-mono text-xs text-indigo-600 font-medium">
                    {brand.aiProfile?.model || "qwen3:4b"}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      {brand.aiProfile?.tone || "Professional"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Link
                      href={`/ai/brands/${brand.id}`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-colors shadow-sm"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>

  );

}