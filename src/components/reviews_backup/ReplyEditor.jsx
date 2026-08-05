"use client";

import { useState } from "react";

export default function ReplyEditor({
  value,
  onChange,
}) {
  const [reply, setReply] = useState(value || "");

  function handleChange(e) {
    setReply(e.target.value);
    onChange?.(e.target.value);
  }

  return (
    <textarea
      value={reply}
      onChange={handleChange}
      rows={8}
      className="w-full border rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="AI reply will appear here..."
    />
  );
}