"use client";

import { useEffect, useState } from "react";

export default function AISettingsPage() {

  const [settings, setSettings] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/ai/settings");
    const data = await res.json();
    setSettings(data);
  }

  if (!settings) return <div className="p-8">Loading...</div>;

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">

        AI Settings

      </h1>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">

        {Object.entries(settings).map(([key,value])=>(

          <div
            key={key}
            className="flex justify-between border-b pb-3"
          >

            <span className="font-medium">

              {key}

            </span>

            <span>

              {String(value)}

            </span>

          </div>

        ))}

      </div>

    </div>

  );

}