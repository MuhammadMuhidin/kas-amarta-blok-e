import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"
import { generateId } from "@/lib/id"

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
        toTitleCase(body.note),
        today
      ]]
    }
  })

  return NextResponse.json({success:true})
}
