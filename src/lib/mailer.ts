import "server-only";
import nodemailer from "nodemailer";

// Mailer SMTP opsional (standalone). Kredensial dari ENV (bukan DB) demi keamanan. Bila SMTP_* tak
// diset -> mailerConfigured() false, fitur email tetap aman dilewati (mis. impor CSV pakai unduhan).
type Cfg = { host: string; port: number; user: string; pass: string; from: string; secure: boolean };

function config(): Cfg | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();
  const from = (process.env.MAIL_FROM ?? process.env.SMTP_USER)?.trim();
  if (!host || !user || !pass || !from) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  return { host, port, user, pass, from, secure: port === 465 };
}

export function mailerConfigured(): boolean {
  return config() !== null;
}

// Kirim email teks polos. Never-throw: kegagalan kirim -> false (pemanggil pilih fallback).
export async function sendMail(to: string, subject: string, text: string): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({ from: cfg.from, to, subject, text });
    return true;
  } catch {
    return false;
  }
}
