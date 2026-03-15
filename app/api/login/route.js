import { NextResponse } from "next/server"

export async function POST(req){

  const {password} = await req.json()
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

  if(password === ADMIN_PASSWORD){

    const res = NextResponse.json({ok:true})

    res.cookies.set("admin","true",{
      httpOnly:true,
      path:"/",
      sameSite:"lax",
      secure: process.env.NODE_ENV === "production"
    })

    return res
  }

  return NextResponse.json({error:true},{status:401})
}