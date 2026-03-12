import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default function AdminPage(){

  const cookieStore = cookies()
  const token = cookieStore.get("admin")

  if(!token){
    redirect("/login")
  }

  return (
    <div style={styles.wrapper}>

      <header style={styles.header}>
        <h1 style={styles.logo}>Admin Panel</h1>
      </header>

      <main style={styles.container}>

        <div style={styles.card}>
          <h2>Dashboard</h2>
          <p>Selamat datang di halaman admin.</p>
        </div>

        <div style={styles.card}>
          <h2>Status</h2>
          <p>Semua sistem berjalan normal.</p>
        </div>

      </main>

    </div>
  )
}

const styles = {

  wrapper:{
    minHeight:"100vh",
    background:"#f4f6f8",
    fontFamily:"system-ui"
  },

  header:{
    height:60,
    background:"#4f46e5",
    color:"#fff",
    display:"flex",
    alignItems:"center",
    padding:"0 20px",
    boxShadow:"0 2px 8px rgba(0,0,0,0.1)"
  },

  logo:{
    fontSize:20,
    fontWeight:"bold"
  },

  container:{
    maxWidth:900,
    margin:"40px auto",
    display:"grid",
    gap:20,
    padding:"0 20px"
  },

  card:{
    background:"#fff",
    padding:20,
    borderRadius:10,
    boxShadow:"0 4px 15px rgba(0,0,0,0.08)"
  }

}