"use client"

import { useState,useEffect } from "react"
import { useRouter } from "next/navigation"

export default function AdminPage(){

  const router = useRouter()
  const [tab,setTab] = useState("personal")
  const [personal,setPersonal] = useState([])

  const [member,setMember] = useState({
    house:"",
    name:"",
    join_date:"",
    trash:""
  })

  const [selected,setSelected] = useState([])
  const [payment,setPayment] = useState({
    period:"",
    amount:25000
  })

  const [cashflow,setCashflow] = useState({
    type:"",
    amount:"",
    note:""
  })

  const [summaryBackup,setSummaryBackup] = useState([])
  const [loadingSummary,setLoadingSummary] = useState(false)

  const [msg,setMsg] = useState("")
  const [loadingAdd,setLoadingAdd] = useState(false)
  const [loadingPayment,setLoadingPayment] = useState(false)
  const [loadingCashflow,setLoadingCashflow] = useState(false)

  async function loadPersonal(){

    const res = await fetch("/api/sheets/personal/list",{cache:"no-store"})
    const data = await res.json()

    setPersonal(data)
  }

  useEffect(()=>{
    loadPersonal()
    loadSummaryBackup()
  },[])

async function addMember(e){

  e.preventDefault()

  setLoadingAdd(true)

  try{

    const res = await fetch("/api/sheets/personal",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(member)
    })

    if(res.ok){

      setMsg("Member added successfully")

      setMember({
        house:"",
        name:"",
        join_date:"",
        trash:""
      })

      loadPersonal()

    }else{

      setMsg("Failed to add member")

    }

  }finally{

    setLoadingAdd(false)

    setTimeout(()=>setMsg(""),3000)

  }

}

function toggleHouse(id){

  if(selected.includes(id)){

    setSelected(
      selected.filter(x=>x!==id)
    )

  }else{

    setSelected([
      ...selected,
      id
    ])

  }

}

async function recordPayment(e){

  e.preventDefault()

  setLoadingPayment(true)

  try{

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

      if(res.ok){

        success++

        const paymentData = await res.json()

        if((p.trash || "").toUpperCase() === "Y"){

          await fetch("/api/sheets/trash",{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body:JSON.stringify({
              payment_id:paymentData.payment_id,
              amount:payment.amount
            })
          })

        }

      }

    }

    setMsg(`Payment recorded for ${success} house successfully`)
    setSelected([])
    setPayment({
      period:"",
      amount:25000
    })

  }finally{

    setLoadingPayment(false)

    setTimeout(()=>setMsg(""),3000)

  }

}

async function addCashflow(e){

  e.preventDefault()

  setLoadingCashflow(true)

  try{

    const res = await fetch("/api/sheets/cashflow",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify(cashflow)
    })

    if(res.ok){

      setMsg("Transaction recorded successfully")

      setCashflow({
        type:"",
        amount:"",
        note:""
      })

    }else{

      setMsg("Failed to record transaction")

    }

  }finally{

    setLoadingCashflow(false)

    setTimeout(()=>setMsg(""),3000)

  }

}

async function loadSummaryBackup(){

  setLoadingSummary(true)

  try{

    const res = await fetch("/api/summary-backup",{
      cache:"no-store"
    })

    const data = await res.json()

    setSummaryBackup(data || [])

  }finally{

    setLoadingSummary(false)

  }

}

  return (
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

      <div style={styles.header}>

        <button
          style={styles.homeBtn}
          onClick={()=>router.push("/")}
        >
          « Home
        </button>

        <h1 style={styles.title}>Cash Flow Management</h1>

      </div>

      {msg && <div style={styles.msg}>{msg}</div>}

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

        <button
          style={tab==="summary"?styles.tabActive:styles.tab}
          onClick={()=>setTab("summary")}
        >
          Summary Backup
        </button>

      </div>

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

            <select
              style={styles.input}
              value={member.trash}
              onChange={e=>setMember({...member,trash:e.target.value})}
            >
              <option value="">Join trash collection?</option>
              <option value="Y">Yes</option>  
              <option value="N">No</option>
            </select>

            <input
              style={styles.input}
              type="date"
              value={member.join_date}
              onChange={e=>setMember({...member,join_date:e.target.value})}
            />

            <button
              style={{
                ...styles.btn,
                ...(loadingAdd ? styles.btnDisabled : {})
              }}
              disabled={loadingAdd}
            >
              {loadingAdd ? "Adding..." : "Add Member"}
            </button>

          </form>

          <h4>Member List</h4>
          <p style={styles.summary}>
            Member active: {
              personal.filter(p=>p.active==="Y").length
            }
            {" | "}
            Member nonactive: {
              personal.filter(p=>p.active==="N").length
            }
          </p>

          <div style={styles.tableWrapper}>

            <table style={styles.table}>

              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>House</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Trash</th>
                  <th style={styles.th}>Active</th>
                  <th style={styles.th}>Join Date</th>
                </tr>
              </thead>

              <tbody>

                {personal
                 .sort((a,b)=>a.house.localeCompare(b.house,undefined,{numeric:true}))
                 .map((p,i)=>{

                  let rowStyle = i % 2 ? styles.rowAlt : null

                  if(p.active === "N"){
                    rowStyle = styles.rowInactive
                  }

                  return (
                    <tr key={p.id} style={rowStyle}>
                      <td style={styles.td}>{p.id}</td>
                      <td style={styles.td}>{p.house}</td>
                      <td style={styles.td}>{p.name}</td>
                      <td style={styles.td}>{p.trash}</td>
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

      {tab==="payment" && (

        <div style={styles.card}>

          <h3>Bulk Payment</h3>

          <form onSubmit={recordPayment} style={styles.form}>

            <input
              style={styles.input}
              placeholder="Period (2026-02)"
              value={payment.period}
              onChange={e=>setPayment({...payment,period:e.target.value})}
            />

            <input
              style={styles.input}
              type="number"
              value={payment.amount}
              onChange={e=>setPayment({...payment,amount:e.target.value})}
            />

            <div style={styles.houseList}>

              {personal
               .filter(p => p.active === "Y")
               .sort((a,b)=>a.house.localeCompare(b.house,undefined,{numeric:true}))
               .map(p=>(

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

            <button
              style={{
                ...styles.btn,
                ...(loadingPayment ? styles.btnDisabled : {})
              }}
              disabled={loadingPayment}
            >
              {loadingPayment ? "Recording..." : "Record Payment"}
            </button>

          </form>

        </div>

      )}

      {tab==="cashflow" && (

        <div style={styles.card}>

          <h3>Cashflow</h3>

          <form onSubmit={addCashflow} style={styles.form}>

            <select
              style={styles.input}
              value={cashflow.type}
              onChange={e=>setCashflow({...cashflow,type:e.target.value})}
            >
              <option value="">Type</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>

            <input
              style={styles.input}
              placeholder="Amount"
              value={cashflow.amount}
              onChange={e=>setCashflow({...cashflow,amount:e.target.value})}
            />

            <input
              style={styles.input}
              placeholder="Note"
              value={cashflow.note}
              onChange={e=>setCashflow({...cashflow,note:e.target.value})}
            />

            <button
              style={{
                ...styles.btn,
                ...(loadingCashflow ? styles.btnDisabled : {})
              }}
              disabled={loadingCashflow}
            >
              {loadingCashflow ? "Recording..." : "Record Transaction"}
            </button>

          </form>

        </div>

      )}

      {tab==="summary" && (

      <div style={styles.card}>
    
        <div style={styles.summaryHeader}>
    
          <h3>Summary Backup</h3>
    
          <button
            style={styles.refreshBtn}
            onClick={loadSummaryBackup}
          >
            Refresh
          </button>
    
        </div>
    
        {loadingSummary ? (
    
          <p>Loading summary...</p>
    
        ) : (
    
          <div style={styles.tableWrapper}>
    
            <table style={styles.table}>
    
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Income</th>
                  <th style={styles.th}>Expense</th>
                  <th style={styles.th}>Net</th>
                  <th style={styles.th}>Personal Active</th>
                </tr>
              </thead>
    
              <tbody>
    
                {summaryBackup.map((x,i)=>(
    
                  <tr
                    key={i}
                    style={i % 2 ? styles.rowAlt : null}
                  >
                    <td style={styles.td}>
                      {x.created_at}
                    </td>
    
                    <td style={styles.td}>
                      Rp {Number(x.total_income || 0).toLocaleString()}
                    </td>
    
                    <td style={styles.td}>
                      Rp {Number(x.total_expense || 0).toLocaleString()}
                    </td>
    
                    <td style={styles.td}>
                      Rp {Number(x.net_saldo || 0).toLocaleString()}
                    </td>
    
                    <td style={styles.td}>
                      {x.total_personal_active}
                    </td>
    
                  </tr>
    
                ))}
    
              </tbody>
    
            </table>
    
          </div>
    
        )}
    
      </div>
    
    )}

    </div>
  </>
  )
}

const styles={

  wrapper:{
    maxWidth:900,
    margin:"0 auto",
    padding:"20px",
    fontFamily:"system-ui",
    background:"#f1f5f9",
    minHeight:"100vh"
  },

  header:{
  display:"flex",
  flexDirection:"column",
  alignItems:"flex-start",
  gap:10,
  marginBottom:20
  },

  title:{
  fontSize:28,
  fontWeight:700,
  margin:0,
  lineHeight:1.2
  },

  homeBtn:{
    padding:"8px 12px",
    border:"none",
    borderRadius:8,
    background:"#e5e7eb",
    cursor:"pointer",
    fontSize:14
  },

  tabs:{
    display:"flex",
    gap:10,
    marginBottom:20
  },

  tab:{
    padding:"10px 18px",
    background:"#e5e7eb",
    border:"none",
    borderRadius:10,
    cursor:"pointer"
  },

  tabActive:{
    padding:"10px 18px",
    background:"#2563eb",
    color:"#fff",
    border:"none",
    borderRadius:10,
    cursor:"pointer",
    fontWeight:500
  },

  card:{
    background:"#ffffff",
    padding:20,
    borderRadius:14,
    boxShadow:"0 2px 12px rgba(0,0,0,0.06)"
  },

  form:{
    display:"grid",
    gap:12,
    width:"100%",
    marginBottom:25
  },

  input:{
    padding:"12px",
    border:"1px solid #d1d5db",
    borderRadius:8,
    fontSize:15,
    width:"100%",
    boxSizing:"border-box"
  },

  btn:{
    padding:"12px",
    border:"none",
    borderRadius:8,
    background:"#2563eb",
    color:"#fff",
    cursor:"pointer",
    fontSize:16,
    fontWeight:500
  },

  btnDisabled:{
    opacity:0.6,
    cursor:"not-allowed"
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

  rowInactive:{
    background:"#fee2e2",
    color:"#991b1b",
    fontWeight:500
  },

  houseList:{
    display:"grid",
    gridTemplateColumns:"repeat(3,1fr)",
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

  summary:{
    marginBottom:12,
    fontSize:14,
    color:"#475569"
  },

  summaryHeader:{
  display:"flex",
  justifyContent:"space-between",
  alignItems:"center",
  marginBottom:16
},

  refreshBtn:{
  padding:"8px 12px",
  border:"none",
  borderRadius:8,
  background:"#0f172a",
  color:"#fff",
  cursor:"pointer"
},

}
