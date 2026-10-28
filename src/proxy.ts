import { getSessionCookie } from "better-auth/cookies"
import { NextResponse, type NextRequest } from "next/server"

// Comprovació optimista: si no hi ha cookie de sessió, cap a /login.
// La validació real es fa al servidor (requireSession).
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  // Exclou API, assets de Next, rutes d'auth i fitxers estàtics (*.ext)
  matcher: [
    "/((?!api|_next/static|_next/image|login|registre|convidar|recuperar-contrasenya|restablir-contrasenya|.*\\..*).*)",
  ],
}
