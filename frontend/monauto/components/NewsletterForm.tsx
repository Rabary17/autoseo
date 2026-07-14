"use client";

import { useState } from "react";
import { WP_SITE_URL } from "@/lib/public-env";

type Status = "idle" | "loading" | "success" | "error";

// Seul point d'interactivité JS de ce site par ailleurs 100% statique.
// Poste directement vers WordPress (voir wp-content/mu-plugins/monauto-headless.php
// section 5) — le frontend Next.js n'a aucun serveur à lui pour recevoir un
// formulaire (export statique, voir docs/architecture-headless.md).
export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch(`${WP_SITE_URL}/wp-json/monauto/v1/newsletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          site_web: honeypot,
          source_url: typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p role="status">Merci, votre inscription est confirmée.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Votre e-mail"
        aria-label="Adresse e-mail"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "loading"}
      />
      {/* Honeypot anti-spam : invisible pour un humain, souvent rempli par un bot */}
      <input
        type="text"
        name="site_web"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />
      <button className="btn btn--primary" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Envoi…" : "S'inscrire"}
      </button>
      {status === "error" && (
        <p role="alert" style={{ color: "#B4552D", fontSize: 13, marginTop: 8 }}>
          Une erreur est survenue, réessayez dans un instant.
        </p>
      )}
    </form>
  );
}
