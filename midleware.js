import { NextResponse } from "next/server"

export function middleware(req) {

  const { pathname } = req.nextUrl
  const hasToken = req.cookies.has("admin")

  /* akses /admin tanpa token → login */
  if (pathname.startsWith("/admin") && !hasToken) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  /* sudah login tapi buka login → admin */
  if (pathname.startsWith("/login") && hasToken) {
    return NextResponse.redirect(new URL("/admin", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/login"]
}