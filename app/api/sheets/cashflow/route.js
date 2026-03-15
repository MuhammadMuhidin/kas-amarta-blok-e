import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"
import { generateId } from "@/lib/id"

const spreadsheetId = process.env.SPREADSHEET_ID

export async function POST(req){

  const body = await req.json()

  const sheets = await getSheets()

  const today = new Date().toISOString().slice(0,10)

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:"cashflow!A:E",
    valueInputOption:"USER_ENTERED",
    requestBody:{
      values:[[
        generateId("CSFLOW-"),
        generateId("DIRECT-"),
        body.type,
        body.amount,
        body.note,
        today
      ]]
    }
  })

  return NextResponse.json({success:true})
}