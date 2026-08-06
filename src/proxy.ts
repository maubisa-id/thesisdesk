import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Proxy (middleware) - arahkan akar domain `/` untuk pengunjung anonim ke /masuk DI EDGE,
// sebelum layout (app) yang menyentuh DB. Tahan banting bila DB tak terjangkau. Matcher hanya
// "/" agar tak ada loop. Pengguna dengan cookie sesi diteruskan ke dashboard.
export function proxy(req: NextRequest) {
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.includes("better-auth.session_token") && c.value);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/masuk";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
