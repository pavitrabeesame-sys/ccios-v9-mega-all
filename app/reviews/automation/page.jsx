"use client";

import { useEffect, useState } from "react";

export default function AutomationPage() {

  const [settings, setSettings] = useState({});

  useEffect(() => {
    load();
  }, []);

  async function load() {

    const res = await fetch("/api/reviews/automation");

    const data = await res.json();

    setSettings(data);

  }

  return (

    <div className="p-8">

      <h1 className="text-3xl font-bold mb-6">
        Automation Rules
      </h1>

      <div className="bg-white rounded-xl shadow p-6">

        {Object.entries(settings).map(([key, value]) => (

          <div
            key={key}
            className="flex justify-between border-b py-3"
          >

            <span className="font-medium">
              {key}
            </span>

            <span
              className={
                value
                  ? "text-green-600 font-semibold"
                  : "text-red-600 font-semibold"
              }
            >
              {String(value)}
            </span>

          </div>

        ))}

      </div>

    </div>

  );

}