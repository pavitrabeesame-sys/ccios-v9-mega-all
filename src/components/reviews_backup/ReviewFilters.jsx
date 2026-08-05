"use client";

import { useState } from "react";

export default function ReviewFilters({ onSearch }) {
  const [search, setSearch] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    onSearch(search);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex gap-3">

      <input
        className="border rounded-lg px-4 py-2 w-96"
        placeholder="Search customer, product or review..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <button
        className="bg-blue-600 text-white px-5 rounded-lg"
        type="submit"
      >
        Search
      </button>

    </form>
  );
}