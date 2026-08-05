'use client';

import React from 'react';

export default function InsightsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Review Insights & Sentiment</h1>
      <p className="text-gray-600 mb-6">Analyze customer feedback trends, sentiment distribution, and key performance indicators.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Sentiment Breakdown</h3>
          <p className="text-gray-500">Positive, neutral, and negative metrics will appear here.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Keyword Analysis</h3>
          <p className="text-gray-500">Frequent product mentions and tags will appear here.</p>
        </div>
      </div>
    </div>

  );
  
}