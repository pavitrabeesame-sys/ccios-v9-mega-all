"use client";

import { useEffect, useState } from "react";

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");

  async function loadCompanies() {
    const res = await fetch("/api/companies");
    const data = await res.json();
    setCompanies(data);
  }

  useEffect(() => {
    loadCompanies();
  }, []);

  async function createCompany(e) {
    e.preventDefault();

    const res = await fetch("/api/companies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        code,
        description,
      }),
    });

    if (res.ok) {
      setName("");
      setCode("");
      setDescription("");

      loadCompanies();
    } else {
      alert("Failed to create company");
    }
  }

  return (
    <div className="p-10">

      <h1 className="text-3xl font-bold mb-8">
        Company Management
      </h1>

      <form
        onSubmit={createCompany}
        className="space-y-4 max-w-lg"
      >

        <input
          className="border p-3 w-full rounded"
          placeholder="Company Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />

        <input
          className="border p-3 w-full rounded"
          placeholder="Company Code"
          value={code}
          onChange={(e)=>setCode(e.target.value)}
        />

        <textarea
          className="border p-3 w-full rounded"
          placeholder="Description"
          value={description}
          onChange={(e)=>setDescription(e.target.value)}
        />

        <button
          className="bg-blue-600 text-white px-6 py-3 rounded"
        >
          Create Company
        </button>

      </form>

      <div className="mt-10">

        <table className="w-full border">

          <thead>

            <tr className="bg-slate-200">

              <th className="p-3">Name</th>
              <th className="p-3">Code</th>
              <th className="p-3">Description</th>

            </tr>

          </thead>

          <tbody>

            {companies.map(company=>(
              <tr key={company.id}>

                <td className="border p-3">{company.name}</td>
                <td className="border p-3">{company.code}</td>
                <td className="border p-3">{company.description}</td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}