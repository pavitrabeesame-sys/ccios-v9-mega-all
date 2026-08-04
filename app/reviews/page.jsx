"use client";

import useReviews from "../../src/hooks/reviews/useReviews";
import ReviewStats from "../../src/components/reviews/ReviewStats";
import ReviewFilters from "../../src/components/reviews/ReviewFilters";
import ReviewTable from "../../src/components/reviews/ReviewTable";
import ImportCSV from "../../src/components/reviews/ImportCSV";

export default function ReviewsPage() {
  const {
    reviews,
    stats,
    loading,
    loadReviews,
  } = useReviews();

  async function smartSync() {
    try {
      const res = await fetch("/api/reviews/smart-sync", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Smart Sync Failed");
        return;
      }

      alert("✅ Smart Review Sync Completed");

      loadReviews();

    } catch (err) {
      alert(err.message);
    }
  }

  async function generateAll() {
    try {
      const res = await fetch("/api/reviews/generate-all", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Generate All Failed");
        return;
      }

      alert(`✅ Generated ${data.total ?? data.generated} AI Replies`);

      loadReviews();

    } catch (err) {
      alert(err.message);
    }
  }

  async function approveAll() {
    try {
      const res = await fetch("/api/reviews/approve-all", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Approve All Failed");
        return;
      }

      alert(`✅ Approved ${data.approved} Reviews`);

      loadReviews();

    } catch (err) {
      alert(err.message);
    }
  }

  async function replyAll() {
    try {
      const res = await fetch("/api/reviews/reply-all", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Reply All Failed");
        return;
      }

      alert(`🚀 Replied ${data.replied} Reviews`);

      loadReviews();

    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="p-8">

      <div className="flex justify-between items-center mb-6">

        <h1 className="text-3xl font-bold">
          NOVA Review Center
        </h1>

        <div className="flex gap-3 flex-wrap">

          <ImportCSV onImported={loadReviews} />

          <button
            onClick={smartSync}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg"
          >
            ⚡ Smart Review Sync
          </button>

          <button
            onClick={generateAll}
            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg"
          >
            ✨ Generate All
          </button>

          <button
            onClick={approveAll}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg"
          >
            ✅ Approve All
          </button>

          <button
            onClick={replyAll}
            className="bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-lg"
          >
            🚀 Reply All
          </button>

          <button
            onClick={loadReviews}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg"
          >
            🔄 Refresh
          </button>

        </div>

      </div>

      <ReviewStats stats={stats} />

      <ReviewFilters onSearch={loadReviews} />

      {loading ? (
        <div className="bg-white rounded-xl shadow p-10 text-center text-gray-500">
          Loading Reviews...
        </div>
      ) : (
        <ReviewTable
          reviews={reviews}
          refresh={loadReviews}
        />
      )}

    </div>
  );
}