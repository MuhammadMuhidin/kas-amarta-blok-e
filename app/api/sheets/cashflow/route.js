import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"
import { generateId } from "@/lib/id"

export const dynamic = "force-dynamic";

const spreadsheetId = process.env.SPREADSHEET_ID

function toTitleCase(str = "") {
  return str
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ")
}

export async function GET(){

  const sheets = await getSheets()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:"Cashflow!A:F"
  })

  const cashflowRes = res.data.values || []

    const data = (cashflowRes.data.values || [])
      .slice(1)
      .map((r) => ({
        __type: "cashflow",
        id: r[0],
        ref_id: r[1],
        type: (r[2] || "").toLowerCase(),
        amount: Number(r[3]) || 0,
        note: r[4],
        date: r[5],
      }));

  return NextResponse.json(data)
}

export async function POST(req){

  const body = await req.json()

  const sheets = await getSheets()

  const today = new Date().toISOString().slice(0,10)

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:"cashflow!A:F",
    valueInputOption:"USER_ENTERED",
    requestBody:{
      values:[[
        generateId("CSFLOW-"),
        generateId("DIRECT-"),
        body.type,
        body.amount,
        toTitleCase(body.note),
        today
      ]]
    }
  })

  return NextResponse.json({success:true})
}
