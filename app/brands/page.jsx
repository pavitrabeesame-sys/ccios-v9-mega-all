"use client";

import { useEffect, useState } from "react";

export default function BrandsPage() {
  const [brands, setBrands] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [companyId, setCompanyId] = useState("");

  const [search, setSearch] = useState("");

  async function loadBrands(keyword = "") {
    const res = await fetch(`/api/brands?search=${keyword}`);
    const json = await res.json();

    if (json.success) {
      setBrands(json.data);
    }
  }

  async function loadCompanies() {
    const res = await fetch("/api/companies");
    const data = await res.json();
    setCompanies(data);
  }

  useEffect(() => {
    loadBrands();
    loadCompanies();
  }, []);

  async function createBrand(e) {
    e.preventDefault();

    const res = await fetch("/api/brands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        code,
        description,
        companyId,
      }),
    });

    const json = await res.json();

    if (json.success) {
      setName("");
      setCode("");
      setDescription("");
      setCompanyId("");

      loadBrands(search);
    } else {
      alert(json.message);
    }
  }

  async function deleteBrand(id) {
    if (!confirm("Delete this brand?")) return;

    const res = await fetch(`/api/brands/${id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (json.success) {
      loadBrands(search);
    }
  }

  return (
    <div className="p-10">

      <h1 className="text-3xl font-bold mb-8">
        Brand Management
      </h1>

      <form
        onSubmit={createBrand}
        className="space-y-4 bg-white shadow rounded-xl p-6 mb-8"
      >

        <input
          className="border p-3 rounded w-full"
          placeholder="Brand Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="border p-3 rounded w-full"
          placeholder="Brand Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <textarea
          className="border p-3 rounded w-full"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <select
          className="border p-3 rounded w-full"
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

        <button
          className="bg-blue-600 text-white px-6 py-3 rounded"
        >
          Create Brand
        </button>

      </form>

      <input
        className="border p-3 rounded w-full mb-6"
        placeholder="Search Brand..."
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          loadBrands(e.target.value);
        }}
      />

      <table className="w-full border bg-white">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-3">Name</th>
            <th className="p-3">Code</th>
            <th className="p-3">Company</th>
            <th className="p-3">Products</th>
            <th className="p-3">Action</th>

          </tr>

        </thead>

        <tbody>

          {brands.map((brand) => (

            <tr key={brand.id}>

              <td className="border p-3">
                {brand.name}
              </td>

              <td className="border p-3">
                {brand.code}
              </td>

              <td className="border p-3">
                {brand.company?.name}
              </td>

              <td className="border p-3">
                {brand.products.length}
              </td>

              <td className="border p-3">

                <button
                  onClick={() => deleteBrand(brand.id)}
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