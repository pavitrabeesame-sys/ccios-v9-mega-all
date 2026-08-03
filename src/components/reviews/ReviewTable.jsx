"use client";

import StatusBadge from "./StatusBadge";
import MarketplaceBadge from "./MarketplaceBadge";

export default function ReviewTable({ reviews, refresh }) {

  async function generate(id) {

    try {

      const res = await fetch("/api/reviews/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "AI generation failed.");
        return;
      }

      refresh?.();

      alert("AI Reply Generated Successfully.");

    } catch (err) {

      alert(err.message);

    }

  }

  async function approve(id) {

    await fetch("/api/reviews/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    refresh?.();

  }

  async function reject(id) {

    await fetch("/api/reviews/reject", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    });

    refresh?.();

  }

  return (

    <div className="bg-white rounded-xl shadow overflow-hidden">

      <table className="w-full">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-3">Customer</th>
            <th className="p-3">Product</th>
            <th className="p-3">Marketplace</th>
            <th className="p-3">Rating</th>
            <th className="p-3">Review</th>
            <th className="p-3">Status</th>
            <th className="p-3">Action</th>

          </tr>

        </thead>

        <tbody>

          {reviews.map((r) => (

            <tr
              key={r.id}
              className="border-t align-top"
            >

              <td className="p-3">

                {r.customerName}

              </td>

              <td className="p-3">

                {r.productName}

              </td>

              <td className="p-3">

                <MarketplaceBadge
                  marketplace={r.marketplace}
                />

              </td>

              <td className="p-3">

                {"⭐".repeat(r.rating)}

              </td>

              <td className="p-3">

                <div className="space-y-3">

                  <div>

                    <div className="font-semibold text-gray-700">

                      Customer Review

                    </div>

                    <div className="text-sm">

                      {r.reviewText}

                    </div>

                  </div>

                  {r.aiReply && (

                    <div className="rounded-lg border border-green-300 bg-green-50 p-3">

                      <div className="font-semibold text-green-700">

                        AI Reply

                      </div>

                      <div className="text-sm whitespace-pre-wrap">

                        {r.aiReply}

                      </div>

                    </div>

                  )}

                </div>

              </td>

              <td className="p-3">

                <StatusBadge
                  status={r.status}
                />

              </td>

              <td className="p-3">

                <div className="flex flex-col gap-2">

                  <button
                    onClick={() => generate(r.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded"
                  >
                    AI
                  </button>

                  <button
                    onClick={() => approve(r.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded"
                  >
                    Approve
                  </button>

                  <button
                    onClick={() => reject(r.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded"
                  >
                    Reject
                  </button>

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}