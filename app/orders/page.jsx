"use client";

import { useEffect, useMemo, useState } from "react";

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      setLoading(true);

      const res = await fetch("/api/orders", {
        cache: "no-store",
      });

      const json = await res.json();

      setOrders(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const keyword = search.toLowerCase();

      return (
        (o.orderId || "").toString().toLowerCase().includes(keyword) ||
        (o.customer || "").toLowerCase().includes(keyword) ||
        (o.status || "").toLowerCase().includes(keyword)
      );
    });
  }, [orders, search]);

  if (loading) {
    return (
      <div className="p-8 text-xl">
        Loading Orders...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">

      <h1 className="text-3xl font-bold mb-6">
        Orders Management
      </h1>

      <div className="bg-white rounded-xl shadow p-4 mb-6">

        <div className="flex gap-4">

          <input
            className="border rounded-lg p-3 flex-1"
            placeholder="Search Order..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <button
            onClick={loadOrders}
            className="bg-blue-600 text-white px-6 rounded-lg"
          >
            Refresh
          </button>

        </div>

      </div>

      <div className="bg-white rounded-xl shadow overflow-auto">

        <table className="w-full">

          <thead className="bg-gray-100">

            <tr>

              <th className="p-4">Order ID</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>

            </tr>

          </thead>

          <tbody>

            {filteredOrders.map((o, i) => (

              <tr
                key={i}
                className="border-t hover:bg-gray-50"
              >

                <td className="p-4">{o.orderId}</td>

                <td className="p-4">
                  {o.customer}
                </td>

                <td className="p-4">
                  RM {Number(o.totalAmount || 0).toFixed(2)}
                </td>

                <td className="p-4">
                  {o.status}
                </td>

                <td className="p-4">
                  {o.createdAt}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}