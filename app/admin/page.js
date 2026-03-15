"use client"

import { useState,useEffect } from "react"

export default function AdminPage(){

  const [tab,setTab] = useState("personal")
  const [personal,setPersonal] = useState([])

  const [member,setMember] = useState({
    house:"",
    name:"",
    join_date:""
  })

  const [selected,setSelected] = useState([])
  const [payment,setPayment] = useState({
    period:"",
    amount:25000
  })

  const [cashflow,setCashflow] = useState({
    type:"income"
  })

  const [msg,setMsg] = useState("")

  async function loadPersonal(){

    const res = await fetch("/api/sheets/personal/list",{cache:"no-store"})
    const data = await res.json()

    setPersonal(data)
  }

  useEffect(()=>{
    loadPersonal()
  },[])

  async function addMember(e){

    e.preventDefault()

    const res = await fetch("/api/sheets/personal",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(member)
    })

    if(res.ok){
      setMsg("Personal berhasil ditambahkan")
      setMember({house:"",name:"",join_date:""})
      loadPersonal()
    }else{
      setMsg("Gagal menambahkan personal")
    }

    setTimeout(()=>setMsg(""),3000)
  }

  function toggleHouse(id){

    if(selected.includes(id)){
      setSelected(selected.filter(x=>x!==id))
    }else{
      setSelected([...selected,id])
    }
  }

  async function recordPayment(e){

    e.preventDefault()

    let success = 0

    for(const id of selected){

      const p = personal.find(x=>x.id===id)

      const res = await fetch("/api/sheets/payment",{
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          house:p.house,
          period:payment.period,
          amount:payment.amount
        })
      })

      if(res.ok) success++
    }

    setMsg(`Payment recorded for ${success} house`)
    setSelected([])

    setTimeout(()=>setMsg(""),3000)
  }

  async function addCashflow(e){

    e.preventDefault()

    const res = await fetch("/api/sheets/cashflow",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(cashflow)
    })

    if(res.ok){
      setMsg("Cashflow recorded")
      setCashflow({type:"income"})
    }else{
      setMsg("Cashflow gagal dicatat")
    }

    setTimeout(()=>setMsg(""),3000)
  }

  return (

    <div style={styles.wrapper}>

      <h1 style={styles.title}>Kas Admin</h1>

      {msg && <div style={styles.msg}>{msg}</div>}

      {/* TAB */}

      <div style={styles.tabs}>

        <button
          style={tab==="personal"?styles.tabActive:styles.tab}
          onClick={()=>setTab("personal")}
        >
          Personal
        </button>

        <button
          style={tab==="payment"?styles.tabActive:styles.tab}
          onClick={()=>setTab("payment")}
        >
          Payment
        </button>

        <button
          style={tab==="cashflow"?styles.tabActive:styles.tab}
          onClick={()=>setTab("cashflow")}
        >
          Cashflow
        </button>

      </div>

      {/* PERSONAL */}

      {tab==="personal" && (

        <div style={styles.card}>

          <h3>Add Personal</h3>

          <form onSubmit={addMember} style={styles.form}>

            <input
              style={styles.input}
              placeholder="House"
              value={member.house}
              onChange={e=>setMember({...member,house:e.target.value})}
            />

            <input
              style={styles.input}
              placeholder="Name"
              value={member.name}
              onChange={e=>setMember({...member,name:e.target.value})}
            />

            <input
              style={styles.input}
              type="date"
              value={member.join_date}
              onChange={e=>setMember({...member,join_date:e.target.value})}
            />

            <button style={styles.btn}>Add</button>

          </form>

          <h4>Member List</h4>

          <div style={styles.tableWrapper}>

          <table style={styles.table}>

            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>House</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Active</th>
                <th style={styles.th}>Join Date</th>
              </tr>
            </thead>

            <tbody>

              {personal.map((p,i)=>{

                let rowStyle = i % 2 ? styles.rowAlt : null

                if(p.active === "N"){
                  rowStyle = styles.rowInactive
                }

                return (
                  <tr key={p.id} style={rowStyle}>
                    <td style={styles.td}>{p.id}</td>
                    <td style={styles.td}>{p.house}</td>
                    <td style={styles.td}>{p.name}</td>
                    <td style={styles.td}>{p.active}</td>
                    <td style={styles.td}>{p.join_date}</td>
                  </tr>
                )
              })}

            </tbody>

          </table>

          </div>

        </div>

      )}

      {/* PAYMENT */}

      {tab==="payment" && (

        <div style={styles.card}>

          <h3>Bulk Payment</h3>

          <form onSubmit={recordPayment} style={styles.form}>

            <input
              style={styles.input}
              placeholder="Period (2026-02)"
              onChange={e=>setPayment({...payment,period:e.target.value})}
            />

            <input
              style={styles.input}
              type="number"
              value={payment.amount}
              onChange={e=>setPayment({...payment,amount:e.target.value})}
            />

            <div style={styles.houseList}>

              {personal.map(p=>(

                <label key={p.id} style={styles.checkbox}>

                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={()=>toggleHouse(p.id)}
                  />

                  {p.house}

                </label>

              ))}

            </div>

            <button style={styles.btn}>Pay</button>

          </form>

        </div>

      )}

      {/* CASHFLOW */}

      {tab==="cashflow" && (

        <div style={styles.card}>

          <h3>Cashflow</h3>

          <form onSubmit={addCashflow} style={styles.form}>

            <select
              style={styles.input}
              value={cashflow.type}
              onChange={e=>setCashflow({...cashflow,type:e.target.value})}
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>

            <input
              style={styles.input}
              placeholder="Amount"
              onChange={e=>setCashflow({...cashflow,amount:e.target.value})}
            />

            <input
              style={styles.input}
              placeholder="Note"
              onChange={e=>setCashflow({...cashflow,note:e.target.value})}
            />

            <button style={styles.btn}>Send</button>

          </form>

        </div>

      )}

    </div>
  )
}

const styles={

  wrapper:{
    maxWidth:1100,
    margin:"20px auto",
    padding:"0 14px",
    fontFamily:"system-ui"
  },

  title:{
    marginBottom:20
  },

  tabs:{
    display:"flex",
    gap:10,
    marginBottom:20,
    flexWrap:"wrap"
  },

  tab:{
    padding:"8px 16px",
    background:"#eee",
    border:"none",
    borderRadius:6,
    cursor:"pointer"
  },

  tabActive:{
    padding:"8px 16px",
    background:"#2563eb",
    color:"#fff",
    border:"none",
    borderRadius:6,
    cursor:"pointer"
  },

  card:{
    background:"#fff",
    padding:24,
    borderRadius:12,
    boxShadow:"0 4px 20px rgba(0,0,0,0.08)"
  },

  form:{
    display:"grid",
    gap:12,
    width:"100%",
    marginBottom:25
  },

  input:{
    padding:"12px",
    border:"1px solid #ddd",
    borderRadius:6,
    fontSize:16,
    width:"100%",
    boxSizing:"border-box"
  },

  btn:{
    padding:"12px",
    border:"none",
    borderRadius:6,
    background:"#2563eb",
    color:"#fff",
    cursor:"pointer",
    fontSize:16
  },

  tableWrapper:{
    overflowX:"auto"
  },

  table:{
    width:"100%",
    borderCollapse:"collapse",
    minWidth:500
  },

  th:{
    textAlign:"left",
    padding:"10px",
    borderBottom:"2px solid #e5e7eb"
  },

  td:{
    padding:"10px",
    borderBottom:"1px solid #f1f5f9"
  },

  rowAlt:{
    background:"#f9fafb"
  },

  houseList:{
    display:"grid",
    gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",
    gap:8,
    marginTop:10
  },

  checkbox:{
    display:"flex",
    gap:6,
    alignItems:"center"
  },

  msg:{
    background:"#dcfce7",
    padding:10,
    borderRadius:6,
    marginBottom:20
  },

  rowInactive:{
    background:"#fee2e2",
    color:"#991b1b",
    fontWeight:500
  }
  
}
