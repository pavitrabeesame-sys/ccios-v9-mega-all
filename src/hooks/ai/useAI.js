"use client";

import { useState } from "react";
import { generate } from "../../services/ai/AIService";

export default function useAI() {

  const [loading, setLoading] = useState(false);

  async function ask(prompt) {

    setLoading(true);

    try {

      const reply = await generate(prompt);

      return reply;

    } finally {

      setLoading(false);

    }

  }

  return {
    ask,
    loading,
  };

}