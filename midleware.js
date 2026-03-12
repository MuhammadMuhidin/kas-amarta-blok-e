import { NextResponse } from "next/server"

export function middleware(req){

  if(req.nextUrl.pathname.startsWith("/admin")){

    const token = req.cookies.get("admin")

    if(!token){
      return NextResponse.redirect(new URL("/login",req.url))
    }

  }

  return NextResponse.next()

}

export const config = {
  matcher:["/admin/:path*"]
}