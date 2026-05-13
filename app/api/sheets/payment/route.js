import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"
import { generateId } from "@/lib/id"

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID

export async function GET(){

  const sheets = await getSheets()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:"Payment!A:G"
  })

  const rows = res.data.values || []

  const data = rows.slice(1).map((r) => ({
        id: r[0],
        person_id: r[1],
        person_house: r[2],
        person_name: r[3],
        period: r[4],
        amount: Number(r[5]) || 0,
        date: r[6],
      }));

  return NextResponse.json(data)
}

export async function POST(req){

  const body = await req.json()

  const sheets = await getSheets()

  const today = new Date().toISOString().slice(0,10)

  /* ========================= */
  /* lookup personal */
  /* ========================= */

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:"personal!A:F"
  })

  const rows = res.data.values || []

  const member = rows.slice(1).find(r => r[1] === body.house)

  if(!member){
    return NextResponse.json(
      { error:"House not found" },
      { status:404 }
    )
  }

  const person_id = member[0]
  const person_house = member[1]
  const person_name = member[2]

  /* ========================= */
  /* generate payment id */
  /* ========================= */

  const paymentId = generateId("PAY-")

  /* ========================= */
  /* insert PAYMENT */
  /* ========================= */

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:"payment!A:G",
    valueInputOption:"USER_ENTERED",
    requestBody:{
      values:[[
        paymentId,
        person_id,
        person_house,
        person_name,
        body.period,
        body.amount,
        today
      ]]
    }
  })

  /* ========================= */
  /* insert CASHFLOW */
  /* ========================= */

  const note =
    `Pembayaran Kas ${person_house} Periode ${body.period}`

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:"cashflow!A:F",
    valueInputOption:"USER_ENTERED",
    requestBody:{
      values:[[
        generateId("CSFLOW-"),
        paymentId,
        "income",
        body.amount,
        note,
        today
      ]]
    }
  })

  return NextResponse.json({
    success:true,
    payment_id:paymentId
  })
}
