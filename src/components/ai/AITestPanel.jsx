"use client";

import { useState } from "react";
import useAI from "../../hooks/ai/useAI";

export default function AITestPanel() {

  const { ask, loading } = useAI();

  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState("");

  async function generate() {

    const result = await ask(prompt);

    setReply(result);

  }

  return (

    <div className="bg-white rounded-xl shadow p-6">

      <textarea
        rows={8}
        value={prompt}
        onChange={(e)=>setPrompt(e.target.value)}
        className="w-full border rounded-lg p-3"
        placeholder="Enter prompt..."
      />

      <button
        onClick={generate}
        disabled={loading}
        className="mt-4 bg-blue-600 text-white px-5 py-2 rounded-lg"
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      <textarea
        rows={10}
        value={reply}
        readOnly
        className="w-full border rounded-lg p-3 mt-5"
      />

    </div>

  );

}