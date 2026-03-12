import { NextResponse } from "next/server"

export function middleware(req){

  const { pathname } = req.nextUrl
  const token = req.cookies.get("admin")?.value

  /* jika akses admin tanpa token → login */
  if(pathname.startsWith("/admin") && !token){
    return NextResponse.redirect(new URL("/login", req.url))
  }

  /* jika sudah login lalu buka /login → admin */
  if(pathname.startsWith("/login") && token){
    return NextResponse.redirect(new URL("/admin", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/login"]
}