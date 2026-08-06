"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { IconArrow, IconCheck } from "@/components/icons";

type Mode = "masuk" | "daftar";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"name" | "email" | "password" | null>(null);

  const isDaftar = mode === "daftar";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorField(null);
    if (isDaftar && name.trim().length < 2) {
      setError("Isi nama lengkapmu, ya.");
      setErrorField("name");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Format email belum benar.");
      setErrorField("email");
      return;
    }
    if (password.length < 8) {
      setError("Kata sandi minimal 8 karakter.");
      setErrorField("password");
      return;
    }
    setLoading(true);
    try {
      const res = isDaftar
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (res.error) {
        setError(
          res.error.message ??
            (isDaftar
              ? "Gagal mendaftar. Coba email lain atau masuk bila sudah punya akun."
              : "Email atau kata sandi salah. Coba lagi."),
        );
        setErrorField(isDaftar ? "email" : "password");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Ada kendala jaringan. Coba lagi sebentar.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {isDaftar ? (
        <Field
          id="name"
          label="Nama lengkap"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
          placeholder="Nama sesuai kampus"
          delay={0}
          invalid={errorField === "name"}
          errorId="auth-error"
        />
      ) : null}
      <Field
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        placeholder="kamu@kampus.ac.id"
        delay={isDaftar ? 60 : 0}
        invalid={errorField === "email"}
        errorId="auth-error"
      />
      <Field
        id="password"
        label="Kata sandi"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete={isDaftar ? "new-password" : "current-password"}
        placeholder={isDaftar ? "Minimal 8 karakter" : "Kata sandimu"}
        delay={isDaftar ? 120 : 60}
        invalid={errorField === "password"}
        errorId="auth-error"
      />

      {error ? (
        <p id="auth-error" role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-600/15">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="group flex w-full items-center justify-center gap-3 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-brand transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
      >
        <span>{loading ? "Memproses…" : isDaftar ? "Buat akun" : "Masuk"}</span>
        {!loading ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5">
            <IconArrow className="h-4 w-4" />
          </span>
        ) : null}
      </button>

      <p className="pt-1 text-center text-sm text-muted-foreground">
        {isDaftar ? "Sudah punya akun? " : "Belum punya akun? "}
        <Link href={isDaftar ? "/masuk" : "/daftar"} className="font-semibold text-brand-600 hover:text-brand-700">
          {isDaftar ? "Masuk" : "Daftar"}
        </Link>
      </p>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  placeholder,
  delay,
  invalid = false,
  errorId,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  placeholder: string;
  delay: number;
  invalid?: boolean;
  errorId?: string;
}) {
  return (
    <div className="animate-rise space-y-1.5" style={{ animationDelay: `${delay}ms` }}>
      <label htmlFor={id} className="block text-[13px] font-semibold text-ink-soft">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && errorId ? errorId : undefined}
        className={`w-full rounded-2xl border-0 bg-card px-4 py-3 text-sm text-ink shadow-soft ring-1 transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
          invalid ? "ring-rose-500 focus:ring-rose-500" : "ring-border focus:ring-brand-400"
        }`}
      />
    </div>
  );
}

export function TrustPoints() {
  const points = [
    "Bimbingan terstruktur - dari judul sampai sidang",
    "Revisi rapi lewat anotasi di dokumen, bukan chat berserakan",
    "Alat skripsi (AI) yang menemani proses, bukan mengerjakan",
  ];
  return (
    <ul className="space-y-3">
      {points.map((p) => (
        <li key={p} className="flex items-start gap-3 text-sm text-white/85">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
            <IconCheck className="h-3.5 w-3.5 text-white" />
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}
