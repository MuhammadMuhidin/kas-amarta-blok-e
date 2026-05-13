"use client"

import { useState,useEffect,useMemo} from "react"
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
  const [payments, setPayments] = useState([])
  const [trashRecords, setTrashRecords] = useState([])

  const [msg,setMsg] = useState("")
  const [loadingAdd,setLoadingAdd] = useState(false)
  const [loadingPayment,setLoadingPayment] = useState(false)
  const [loadingCashflow,setLoadingCashflow] = useState(false)

  async function loadPersonal(){

    const res = await fetch("/api/sheets/personal", {
      cache: "no-store",
      method: "GET",
    });

    const data = await res.json();

    setPersonal(data)
  }

  async function loadPayment(){

  const res = await fetch("/api/sheets/payment", {
      cache: "no-store",
      method: "GET",
    });

  const data = await res.json()

  setPayments(data || [])
  }

  async function loadTrash(){
  const res = await fetch("/api/sheets/trash", {
      cache: "no-store",
      method: "GET",
    });

  const data = await res.json()
  
  setTrashRecords(data || [])
  }

  useEffect(()=>{
    loadPersonal()
    loadSummaryBackup()
    loadPayment()
    loadTrash()
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

  const stats = useMemo(() => {
  return personal.reduce(
    (acc, p) => {
      if (p.active === "Y") acc.active++;
      else acc.inactive++;

      if (p.trash === "Y") acc.trashActive++;
      else acc.trashInactive++;

      return acc;
    },
    { active: 0, inactive: 0, trashActive: 0, trashInactive: 0 }
  );
}, [personal]);

const trashMismatch = useMemo(() => {
  const issues = [];

  // Semua payment id yang punya trash
  const trashPaymentIds = new Set(
    trashRecords.map((t) =>
      String(t.payment_id || "").trim()
    )
  );

  personal.forEach((p) => {
    const isTrashUser =
      (p.trash || "").toUpperCase() === "Y";

    // payment milik person ini
    const personPayments = payments.filter(
      (pay) =>
        String(pay.person_id).trim() ===
        String(p.id).trim()
    );

    personPayments.forEach((pay) => {
      const paymentId = String(
        pay.id || ""
      ).trim();

      const hasTrash =
        trashPaymentIds.has(paymentId);

      // CASE 1
      // User wajib trash tapi payment tidak punya trash record
      if (isTrashUser && !hasTrash) {
        issues.push({
          type: "PAYMENT_WITHOUT_TRASH",
          house: p.house,
          name: p.name,
          period: pay.period,
          detail:
            "User wajib sampah tapi tidak ada trash record",
        });
      }

      // CASE 2
      // User non-trash tapi payment punya trash record
      if (!isTrashUser && hasTrash) {
        issues.push({
          type: "NON_TRASH_HAS_TRASH",
          house: p.house,
          name: p.name,
          period: pay.period,
          detail:
            "User non-trash tapi punya trash record",
        });
      }
    });
  });

  // CASE 3
  // Trash record tanpa payment
  trashRecords.forEach((t) => {
    const tPaymentId = String(
      t.payment_id || ""
    ).trim();

    const paymentExists = payments.some(
      (pay) =>
        String(pay.id || "").trim() ===
        tPaymentId
    );

    if (!paymentExists && tPaymentId) {
      issues.push({
        type: "ORPHAN_TRASH_RECORD",
        house: "-",
        name: "-",
        period: `Payment ID: ${tPaymentId}`,
        detail:
          "Trash record merujuk payment yang tidak ada",
      });
    }
  });

  return issues;
}, [personal, payments, trashRecords]);

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

<button
  style={tab==="monitoring"?styles.tabActive:styles.tab}
  onClick={()=>setTab("monitoring")}
>
  Monitoring
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
            <div style={styles.summaryCards}>
              <div style={styles.summaryCard}>
              <div>Active</div>
              <b>{stats.active}</b>
              </div>

              <div style={styles.summaryCard}>
              <div>Inactive</div>
              <b>{stats.inactive}</b>
              </div>

              <div style={styles.summaryCard}>
              <div>Trash Active</div>
              <b>{stats.trashActive}</b>
              </div>

              <div style={styles.summaryCard}>
              <div>Trash Inactive</div>
              <b>{stats.trashInactive}</b>
              </div>
            </div>
              
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
                      Rp{Number(x.total_income || 0).toLocaleString()}
                    </td>
    
                    <td style={styles.td}>
                      Rp{Number(x.total_expense || 0).toLocaleString()}
                    </td>
    
                    <td style={styles.td}>
                      Rp{Number(x.net_saldo || 0).toLocaleString()}
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

{tab === "monitoring" && (
  <div style={styles.card}>
    <h3>Trash Payment Monitoring</h3>

    {/* Summary */}
    <div style={styles.summaryCards}>
      <div style={styles.summaryCard}>
        <div>Missing Trash Payment</div>
        <b>{trashMismatch.length}</b>
      </div>
    </div>

    {/* Empty */}
    {trashMismatch.length === 0 ? (
      <div
        style={{
          padding: 16,
          background: "#ecfdf5",
          border: "1px solid #10b981",
          borderRadius: 10,
          color: "#065f46",
          fontWeight: 500,
          textAlign: "center",
        }}
      >
        Tidak ada issue
      </div>
    ) : (
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
<thead>
  <tr>
    <th style={styles.th}>House</th>
    <th style={styles.th}>Name</th>
    <th style={styles.th}>Period</th>
    <th style={styles.th}>Issue</th>
  </tr>
</thead>

<tbody>
  {trashMismatch.map((x, i) => (
    <tr
      key={i}
      style={i % 2 ? styles.rowAlt : null}
    >
      <td style={styles.td}>{x.house}</td>

      <td style={styles.td}>{x.name}</td>

      <td style={styles.td}>{x.period}</td>

      <td
        style={{
          ...styles.td,
          color: "#991b1b",
          fontWeight: 600,
        }}
      >
        {x.detail}
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
  width:"100%",
  maxWidth:900,
  margin:"0 auto",
  padding:"20px",
  boxSizing:"border-box",
  overflowX:"hidden",
  fontFamily:"system-ui",
  background:"#f1f5f9"
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
  marginBottom:20,
  flexWrap:"wrap"
  },

  tab:{
  padding:"10px 18px",
  background:"#e5e7eb",
  border:"none",
  borderRadius:10,
  cursor:"pointer",
  flexShrink:0
  },

  tabActive:{
  padding:"10px 18px",
  background:"#2563eb",
  color:"#fff",
  border:"none",
  borderRadius:10,
  cursor:"pointer",
  fontWeight:500,
  flexShrink:0
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
    minWidth:500,
    tableLayout:"auto"
  },

  th:{
    textAlign:"center",
    verticalAlign:"middle",
    padding:"10px",
    borderBottom:"2px solid #e5e7eb",
    whiteSpace:"nowrap"
  },

  td:{
    textAlign:"center",
    verticalAlign:"middle",
    padding:"10px",
    borderBottom:"1px solid #f1f5f9",
    whiteSpace:"nowrap"
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

  summaryGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
  fontSize: 14,
  color: "#475569",
  marginBottom: 16
},

summaryCards: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  marginBottom: 16
},

summaryCard: {
  padding: 12,
  borderRadius: 10,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  textAlign: "center"
}
}
