"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Login(){

  const router = useRouter()
  const [password,setPassword] = useState("")

  async function submit(e){
    e.preventDefault()

    const res = await fetch("/api/login",{
      method:"POST",
      body:JSON.stringify({password})
    })

    if(res.ok){
      router.push("/admin")
    }else{
      alert("Password salah")
    }
  }

  return(
    <form onSubmit={submit} style={{maxWidth:300}}>
      <h2>Login Admin</h2>

      <input
        type="password"
        placeholder="Password"
        onChange={(e)=>setPassword(e.target.value)}
      />

      <button type="submit">
        Login
      </button>
    </form>
  )
}