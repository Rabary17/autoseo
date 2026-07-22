import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// Destinataire fixe, non modifiable par l'utilisateur (jamais lu depuis le
// corps de la requête) : le formulaire public n'affiche aucune adresse e-mail,
// mais tout message y est bien envoyé.
const CONTACT_TO = "andrianina.rabarivelo@gmail.com";

const MAX_LEN = { name: 120, email: 254, subject: 200, message: 5000 };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  // Honeypot anti-spam (champ invisible côté client, voir NewsletterForm.tsx) :
  // un humain le laisse toujours vide.
  const honeypot = String(body.website ?? "").trim();

  if (honeypot) return NextResponse.json({ ok: true });

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (
    name.length > MAX_LEN.name ||
    email.length > MAX_LEN.email ||
    subject.length > MAX_LEN.subject ||
    message.length > MAX_LEN.message
  ) {
    return NextResponse.json({ error: "field_too_long" }, { status: 400 });
  }

  const transport = getTransport();
  if (!transport) {
    console.error("[api/contact] SMTP non configuré (SMTP_HOST/PORT/USER/PASS manquants)");
    return NextResponse.json({ error: "mail_not_configured" }, { status: 503 });
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: CONTACT_TO,
      replyTo: `${name} <${email}>`,
      subject: `[Contact monauto] ${subject}`,
      text: `De : ${name} <${email}>\nObjet : ${subject}\n\n${message}`,
      html: `<p><strong>De :</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
<p><strong>Objet :</strong> ${escapeHtml(subject)}</p>
<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[api/contact] échec d'envoi: ${e}`);
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
}
