"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/dashboard",
    });
  }

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        background: "#111827",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 360,
          background: "#1f2937",
          padding: 30,
          borderRadius: 12,
        }}
      >
        <h1 style={{ color: "white", textAlign: "center" }}>
          CCIOS Login
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 20,
            borderRadius: 6,
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            marginTop: 15,
            borderRadius: 6,
          }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            marginTop: 20,
            padding: 12,
            borderRadius: 6,
            background: "#2563eb",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Login
        </button>
      </form>
    </div>
  );
}