// src/components/review/ReviewSearch.jsx

"use client";

import { useState } from "react";

export default function ReviewSearch({ onSearch }) {

  const [keyword, setKeyword] = useState("");

  return (

    <div className="flex gap-3 mb-5">

      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Search review..."
        className="border rounded-lg px-4 py-2 w-full"
      />

      <button
        onClick={() => onSearch(keyword)}
        className="bg-blue-600 text-white px-5 rounded-lg"
      >
        Search
      </button>

    </div>

  );

}