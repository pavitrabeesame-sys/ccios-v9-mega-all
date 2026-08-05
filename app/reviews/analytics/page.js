'use client';

import React from 'react';

export default function AnalyticsPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Review Analytics Dashboard</h1>
      <p className="text-gray-600 mb-6">Monitor your review sentiment, ratings, and multi-brand performance metrics.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Total Reviews</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">Average Rating</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-gray-100">
          <h3 className="text-sm font-medium text-gray-500">AI Response Rate</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">-</p>
        </div>
      </div>
    </div>

  );
  
}