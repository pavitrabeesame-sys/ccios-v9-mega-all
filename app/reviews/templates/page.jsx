"use client";

import { useEffect, useState } from "react";

export default function TemplatesPage() {

  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {

    const res = await fetch("/api/reviews/templates");

    const data = await res.json();

    setTemplates(data);

  }

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">
        Reply Templates
      </h1>

      <table className="w-full bg-white rounded-xl shadow">

        <thead className="bg-slate-100">

          <tr>

            <th className="p-3 text-left">Brand</th>
            <th className="p-3 text-left">Rating</th>
            <th className="p-3 text-left">Title</th>
            <th className="p-3 text-left">Template</th>

          </tr>

        </thead>

        <tbody>

          {templates.map((t) => (

            <tr key={t.id} className="border-t">

              <td className="p-3">{t.brand}</td>

              <td className="p-3">{t.rating}★</td>

              <td className="p-3">{t.title}</td>

              <td className="p-3">{t.template}</td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}