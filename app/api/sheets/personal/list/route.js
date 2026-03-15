import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"

export const dynamic = "force-dynamic"

const spreadsheetId = process.env.SPREADSHEET_ID

export async function GET(){

  const sheets = await getSheets()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:"personal!A:E"
  })

  const rows = res.data.values || []

  const data = rows.slice(1).map(r=>({
    id:r[0],
    house:r[1],
    name:r[2],
    active:r[3],
    join_date:r[4]
  }))

  return NextResponse.json(data)
}