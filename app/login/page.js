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
    <div style={styles.wrapper}>
      <form onSubmit={submit} style={styles.card}>

        <h2 style={styles.title}>Admin Login</h2>

        <input
          type="password"
          placeholder="Password"
          onChange={(e)=>setPassword(e.target.value)}
          style={styles.input}
        />

        <button type="submit" style={styles.button}>
          Login
        </button>

      </form>
    </div>
  )
}

const styles = {

  wrapper:{
    height:"100vh",
    display:"flex",
    justifyContent:"center",
    alignItems:"center",
    background:"linear-gradient(135deg,#4f46e5,#6366f1)",
    fontFamily:"system-ui"
  },

  card:{
    width:320,
    padding:30,
    background:"#fff",
    borderRadius:12,
    boxShadow:"0 10px 25px rgba(0,0,0,0.15)",
    display:"flex",
    flexDirection:"column",
    gap:15
  },

  title:{
    textAlign:"center",
    marginBottom:10
  },

  input:{
    padding:12,
    borderRadius:8,
    border:"1px solid #ddd",
    fontSize:14
  },

  button:{
    padding:12,
    borderRadius:8,
    border:"none",
    background:"#4f46e5",
    color:"#fff",
    fontWeight:"bold",
    cursor:"pointer"
  }

}