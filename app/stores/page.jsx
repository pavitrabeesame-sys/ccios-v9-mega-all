"use client";

import { useEffect, useState } from "react";

export default function StoresPage() {
  const [stores, setStores] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [marketplace, setMarketplace] = useState("SHOPEE");

  const [search, setSearch] = useState("");

  async function loadStores(keyword = "") {
    const res = await fetch(`/api/stores?search=${keyword}`);
    const json = await res.json();

    if (json.success) {
      setStores(json.data);
    }
  }

  async function loadCompanies() {
    const res = await fetch("/api/companies");
    const data = await res.json();

    setCompanies(data);
  }

  useEffect(() => {
    loadStores();
    loadCompanies();
  }, []);

  async function createStore(e) {
    e.preventDefault();

    const res = await fetch("/api/stores", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        companyId,
        marketplace,
      }),
    });

    const json = await res.json();

    if (json.success) {
      setName("");
      setCompanyId("");
      setMarketplace("SHOPEE");

      loadStores(search);
    } else {
      alert(json.message);
    }
  }

  async function deleteStore(id) {
    if (!confirm("Delete this store?")) return;

    const res = await fetch(`/api/stores/${id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (json.success) {
      loadStores(search);
    }
  }

  return (
    <div className="p-10">

      <h1 className="text-3xl font-bold mb-8">
        Store Management
      </h1>

      <form
        onSubmit={createStore}
        className="bg-white rounded-xl shadow p-6 space-y-4 mb-8"
      >

        <input
          className="border rounded p-3 w-full"
          placeholder="Store Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <select
          className="border rounded p-3 w-full"
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">Select Company</option>

          {companies.map((company) => (
            <option
              key={company.id}
              value={company.id}
            >
              {company.name}
            </option>
          ))}
        </select>

        <select
          className="border rounded p-3 w-full"
          value={marketplace}
          onChange={(e) => setMarketplace(e.target.value)}
        >
          <option value="SHOPEE">Shopee</option>
          <option value="LAZADA">Lazada</option>
          <option value="TIKTOK">TikTok Shop</option>
          <option value="WEBSITE">Website</option>
        </select>

        <button
          className="bg-blue-600 text-white px-6 py-3 rounded"
        >
          Create Store
        </button>

      </form>

      <input
        className="border rounded p-3 w-full mb-6"
        placeholder="Search Store..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          loadStores(e.target.value);
        }}
      />

      <table className="w-full bg-white border">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-3">Store</th>
            <th className="p-3">Marketplace</th>
            <th className="p-3">Company</th>
            <th className="p-3">Orders</th>
            <th className="p-3">Action</th>

          </tr>

        </thead>

        <tbody>

          {stores.map((store) => (

            <tr key={store.id}>

              <td className="border p-3">
                {store.name}
              </td>

              <td className="border p-3">
                {store.marketplace}
              </td>

              <td className="border p-3">
                {store.company?.name}
              </td>

              <td className="border p-3">
                {store.orders.length}
              </td>

              <td className="border p-3">

                <button
                  onClick={() => deleteStore(store.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded"
                >
                  Delete
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}