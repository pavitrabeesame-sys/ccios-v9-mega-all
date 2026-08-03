"use client";

export default function BulkToolbar({
  selected = [],
  onApprove,
  onReject,
}) {
  return (
    <div className="flex gap-3 mb-5">

      <button
        disabled={!selected.length}
        onClick={onApprove}
        className="bg-green-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-300"
      >
        Approve ({selected.length})
      </button>

      <button
        disabled={!selected.length}
        onClick={onReject}
        className="bg-red-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-300"
      >
        Reject ({selected.length})
      </button>

    </div>
  );
}