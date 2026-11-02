// =============================================================================
// E-MAIL-VERSAND über SMTP (Standard: Gmail mit App-Passwort).
//
// Umgebungsvariablen:
//   SMTP_USER  — das Postfach, z. B. schriftbot@gmail.com
//   SMTP_PASS  — Google-App-Passwort (16 Zeichen, ohne Leerzeichen)
//   SMTP_HOST  — optional, Standard smtp.gmail.com
//   SMTP_PORT  — optional, Standard 465 (TLS)
//
// Gmail versendet bis ca. 500 E-Mails am Tag kostenlos. Jede gesendete
// E-Mail liegt danach im Ordner „Gesendet“ — das ist zugleich der Nachweis,
// dass die Bestätigung rausging.
//
// sendeMail wirft nie: Eine fehlgeschlagene Bestätigung darf weder die
// Kündigung noch den Widerruf noch den Webhook scheitern lassen. Sie wird
// geloggt und am Datensatz vermerkt, damit sie nachgeholt werden kann.
// =============================================================================
const nodemailer = require("nodemailer");

const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

let transporter = null;
if (SMTP_USER && SMTP_PASS) {
  const port = Number(process.env.SMTP_PORT || 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.warn(
    "⚠️ SMTP_USER/SMTP_PASS fehlen — Bestätigungs-E-Mails werden NICHT versendet."
  );
}

async function sendeMail({ an, betreff, text }) {
  if (!transporter) return { ok: false, fehler: "smtp-nicht-konfiguriert" };
  if (!an) return { ok: false, fehler: "keine-empfaengeradresse" };
  try {
    const info = await transporter.sendMail({
      from: `"Schriftbot" <${SMTP_USER}>`,
      to: an,
      subject: betreff,
      text,
    });
    console.log(`✉️ E-Mail „${betreff}“ an ${an} gesendet (${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ E-Mail „${betreff}“ an ${an} fehlgeschlagen:`, err.message);
    return { ok: false, fehler: String(err.message || err).slice(0, 300) };
  }
}

module.exports = { sendeMail };
