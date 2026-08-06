"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/auth/auth-form";
import { IconArrow } from "@/components/icons";
import { completeSetup } from "@/app/setup/actions";

export function SetupForm() {
  const router = useRouter();
  const [institutionName, setInstitutionName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (institutionName.trim().length < 2) return setError("Isi nama institusi.");
    if (name.trim().length < 2) return setError("Isi nama admin.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Format email belum benar.");
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");
    setLoading(true);
    const res = await completeSetup({ institutionName, logoUrl: logoUrl.trim() || undefined, name, email, password });
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field id="institutionName" label="Nama institusi" type="text" value={institutionName} onChange={setInstitutionName} autoComplete="organization" placeholder="mis. Universitas Nusantara" delay={0} />
      <Field id="logoUrl" label="URL logo (opsional)" type="url" value={logoUrl} onChange={setLogoUrl} autoComplete="off" placeholder="https://kampus.ac.id/logo.png" delay={40} />
      <Field id="name" label="Nama admin" type="text" value={name} onChange={setName} autoComplete="name" placeholder="Nama lengkapmu" delay={60} />
      <Field id="email" label="Email admin" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="admin@kampus.ac.id" delay={120} />
      <Field id="password" label="Kata sandi" type="password" value={password} onChange={setPassword} autoComplete="new-password" placeholder="Minimal 8 karakter" delay={180} />

      {error ? (
        <p role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-600/15">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="group flex w-full items-center justify-center gap-3 rounded-full bg-brand-500 py-3 text-sm font-semibold text-white shadow-brand transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
      >
        <span>{loading ? "Menyiapkan…" : "Selesaikan penyiapan"}</span>
        {!loading ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5">
            <IconArrow className="h-4 w-4" />
          </span>
        ) : null}
      </button>
    </form>
  );
}
