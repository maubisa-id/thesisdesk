import type { NextConfig } from "next";

// Header keamanan enterprise (Fondasi §5.3). thesis-next = app di balik login berbasis
// cookie; mutasi lewat Server Action. frame-ancestors cegah clickjacking, HSTS paksa TLS
// di domain cookie `.maubisa.id`, sisanya hardening standar. CSP nonce ditegakkan di proxy.ts.
const nextConfig: NextConfig = {
  // Standalone build -> image Docker ramping (hanya file yang dipakai). Aman: `next start` & dev
  // tak terpengaruh; hanya menambah folder .next/standalone untuk kontainer (deploy institusi).
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
