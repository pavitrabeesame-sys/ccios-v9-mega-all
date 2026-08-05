// src/components/review/ReviewFilters.jsx

"use client";

export default function ReviewFilters({ onFilter }) {

  return (

    <div className="flex gap-3 mb-5">

      <select
        onChange={(e)=>onFilter("status",e.target.value)}
        className="border rounded-lg p-2"
      >
        <option value="">All Status</option>
        <option>PENDING</option>
        <option>GENERATED</option>
        <option>APPROVED</option>
        <option>REPLIED</option>
        <option>REJECTED</option>
      </select>

      <select
        onChange={(e)=>onFilter("rating",e.target.value)}
        className="border rounded-lg p-2"
      >
        <option value="">All Rating</option>
        <option>5</option>
        <option>4</option>
        <option>3</option>
        <option>2</option>
        <option>1</option>
      </select>

      <select
        onChange={(e)=>onFilter("sentiment",e.target.value)}
        className="border rounded-lg p-2"
      >
        <option value="">All Sentiment</option>
        <option>POSITIVE</option>
        <option>NEUTRAL</option>
        <option>NEGATIVE</option>
      </select>

    </div>

  );

}