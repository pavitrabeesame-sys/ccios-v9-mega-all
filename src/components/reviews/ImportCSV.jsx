"use client";

import { useState } from "react";
import { importCSV } from "../../services/reviews/ImportService";

export default function ImportCSV({ onImported }) {

  const [loading, setLoading] = useState(false);

  async function handleChange(e) {

    const file = e.target.files?.[0];

    if (!file) return;

    setLoading(true);

    try {

      const result = await importCSV(file);

      alert(result.message);

      onImported?.();

    } catch (err) {

      alert(err.message);

    } finally {

      setLoading(false);

    }

  }

  return (

    <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer">

      {loading ? "Uploading..." : "Import Shopee CSV"}

      <input
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleChange}
      />

    </label>

  );

}