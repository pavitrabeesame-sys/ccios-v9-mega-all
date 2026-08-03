"use client";

import { useEffect, useState } from "react";

export default function AIModelsPage() {

  const [data, setData] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/ai/models");
    const json = await res.json();
    setData(json);
  }

  if (!data) return <div className="p-8">Loading...</div>;

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        AI Models

      </h1>

      <div className="bg-white rounded-xl shadow p-6">

        <div className="mb-6">

          <strong>Active Model:</strong> {data.active}

        </div>

        <table className="w-full">

          <thead className="bg-slate-100">

            <tr>

              <th className="p-3">Model</th>
              <th className="p-3">Provider</th>
              <th className="p-3">RAM</th>
              <th className="p-3">Recommended</th>

            </tr>

          </thead>

          <tbody>

            {data.installed.map((m)=>(

              <tr key={m.name} className="border-t">

                <td className="p-3">{m.name}</td>
                <td className="p-3">{m.provider}</td>
                <td className="p-3">{m.ram}</td>
                <td className="p-3">
                  {m.recommended ? "Yes" : "No"}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>

  );

}