// Konfigurasi engine database + guard fail-fast. Prisma mewajibkan `datasource.provider` di
// schema.prisma berupa literal statis (tidak bisa dari env). Guard ini memastikan 3 titik
// konsisten saat pindah ke MySQL: (1) schema.prisma provider (2) DB_PROVIDER (3) DATABASE_URL.

const ALLOWED = ["sqlite", "mysql", "postgresql"] as const;
export type DbProvider = (typeof ALLOWED)[number];

export const DB_PROVIDER: DbProvider = (() => {
  const raw = (process.env.DB_PROVIDER ?? "sqlite").toLowerCase();
  if (!(ALLOWED as readonly string[]).includes(raw)) {
    throw new Error(`DB_PROVIDER tidak valid: "${raw}". Pilih: ${ALLOWED.join(", ")}.`);
  }
  return raw as DbProvider;
})();

function urlMatchesProvider(url: string, provider: DbProvider): boolean {
  const scheme = url.split(":", 1)[0]?.toLowerCase() ?? "";
  switch (provider) {
    case "sqlite":
      return url.startsWith("file:") || scheme === "sqlite";
    case "mysql":
      return scheme === "mysql";
    case "postgresql":
      return scheme === "postgresql" || scheme === "postgres";
  }
}

export function assertDbUrlMatchesProvider(): void {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return;
  if (!urlMatchesProvider(url, DB_PROVIDER)) {
    const scheme = url.split(":", 1)[0]?.toLowerCase() ?? "?";
    throw new Error(
      `Konfigurasi database tidak konsisten: DB_PROVIDER="${DB_PROVIDER}" tetapi ` +
        `DATABASE_URL memakai skema "${scheme}:". Samakan schema.prisma, DB_PROVIDER, DATABASE_URL.`,
    );
  }
}
