"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function Login(){

  const router = useRouter()

  const [step,setStep] =
    useState("password")

  const [password,setPassword] =
    useState("")

  const [pin,setPin] =
    useState("")

  async function submit(e){

    e.preventDefault()

    const payload =
      step === "password"
        ? { password }
        : { pin }

    const res = await fetch(
      "/api/login",
      {
        method:"POST",

        headers:{
          "Content-Type":
            "application/json"
        },

        body:JSON.stringify(
          payload
        )
      }
    )

    const data =
      await res.json()

    if(!res.ok){

      alert(
        data.error ||
        "Login gagal"
      )

      return
    }

    // password benar,
    // backend minta pin
    if(data.need_pin){

      setStep("pin")

      return
    }

    // login sukses
    router.push("/admin")
  }

  return(
    <>
      <style jsx global>{`
        html{
          background:#f1f5f9;
        }

        @media (prefers-color-scheme: dark){
          html{
            filter: invert(1) hue-rotate(180deg);
          }
        }
      `}</style>

      <div style={styles.wrapper}>

        <form
          onSubmit={submit}
          style={styles.card}
        >

          <h2 style={styles.title}>
            Admin Login
          </h2>

          {step ===
            "password" && (

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e)=>
                setPassword(
                  e.target.value
                )
              }
              style={styles.input}
            />

          )}

          {step ===
            "pin" && (

            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              value={pin}
              autoFocus
              onChange={(e)=>
                setPin(
                  e.target.value
                )
              }
              style={styles.input}
            />

          )}

          <button
            type="submit"
            style={styles.button}
          >

            {step ===
              "password"

              ? "Continue"

              : "Verify PIN"}

          </button>

        </form>

      </div>
    </>
  )
}

const styles = {

  wrapper:{
    height:"100vh",
    display:"flex",
    justifyContent:"center",
    alignItems:"center",
    background:"#e5e7eb",
    fontFamily:"system-ui"
  },

  card:{
    width:320,
    padding:30,
    background:"#fff",
    borderRadius:12,
    boxShadow:
      "0 10px 25px rgba(0,0,0,0.15)",

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
