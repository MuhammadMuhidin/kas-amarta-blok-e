import { NextResponse } from "next/server";

export function middleware(request) {
  const token = request.cookies.get("admin")?.value;
  const { pathname } = request.nextUrl;

  /* LOGIN PAGE */
  if (pathname.startsWith("/login")) {
    if (token) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  /* ADMIN PAGE */
  if (pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login"]
};
