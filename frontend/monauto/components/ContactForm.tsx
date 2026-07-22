"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message, website: honeypot }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="contact-form__status contact-form__status--ok" role="status">
        Merci, votre message a bien été envoyé. Nous vous répondrons dès que possible.
      </p>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-form__row">
        <div>
          <label htmlFor="contact-name">Nom / prénom</label>
          <input
            id="contact-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={status === "loading"}
          />
        </div>
        <div>
          <label htmlFor="contact-email">E-mail</label>
          <input
            id="contact-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "loading"}
          />
        </div>
      </div>
      <div>
        <label htmlFor="contact-subject">Objet</label>
        <input
          id="contact-subject"
          type="text"
          required
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={status === "loading"}
        />
      </div>
      <div>
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={status === "loading"}
        />
      </div>
      {/* Honeypot anti-spam : invisible pour un humain, souvent rempli par un bot */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
      />
      <button className="btn btn--primary" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Envoi…" : "Envoyer le message"}
      </button>
      <p className="contact-form__note">
        Aucune adresse e-mail n&apos;est publiée sur ce site : votre message nous parvient
        directement via ce formulaire.
      </p>
      {status === "error" && (
        <p className="contact-form__status contact-form__status--err" role="alert">
          Une erreur est survenue, réessayez dans un instant.
        </p>
      )}
    </form>
  );
}
