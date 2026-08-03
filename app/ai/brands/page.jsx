"use client";

import { useEffect, useState } from "react";

export default function AIBrandsPage() {

  const [brands, setBrands] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {

    const res = await fetch("/api/ai/brands");

    const data = await res.json();

    setBrands(data);

  }

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        AI Brand Profiles

      </h1>

      <table className="w-full bg-white rounded-xl shadow">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-3">Brand</th>
            <th className="p-3">Store</th>
            <th className="p-3">Model</th>
            <th className="p-3">Tone</th>
            <th className="p-3">Status</th>

          </tr>

        </thead>

        <tbody>

          {brands.map((brand)=>(

            <tr key={brand.id} className="border-t">

              <td className="p-3">{brand.brand}</td>

              <td className="p-3">{brand.store}</td>

              <td className="p-3">{brand.model}</td>

              <td className="p-3">{brand.tone}</td>

              <td className="p-3">
                {brand.active ? "Active" : "Disabled"}
              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}