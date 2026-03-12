import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default function AdminPage(){

  const cookieStore = cookies()
  const token = cookieStore.get("admin")

  if(!token){
    redirect("/login")
  }

  return <div>Admin Panel</div>
}