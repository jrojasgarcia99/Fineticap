import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { needsMfaChallenge } from "./mfa";

const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/privacidad", "/terminos", "/seguridad"];
const MFA_CHALLENGE_PATH = "/mfa-challenge";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/"; // la raíz elige la pantalla de inicio según nav_order
    return NextResponse.redirect(url);
  }

  // Quien activó 2FA queda en AAL1 justo después de signInWithPassword —
  // exigimos completar el desafío antes de ver cualquier otra pantalla.
  if (user && !request.nextUrl.pathname.startsWith(MFA_CHALLENGE_PATH)) {
    if (await needsMfaChallenge(supabase)) {
      const url = request.nextUrl.clone();
      url.pathname = MFA_CHALLENGE_PATH;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
