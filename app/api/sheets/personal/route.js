import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"
import { generateId } from "@/lib/id"

const spreadsheetId = process.env.SPREADSHEET_ID

export async function POST(req){

  const body = await req.json()

  const sheets = await getSheets()

  const id = generateId()

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range:"personal!A:F",
    valueInputOption:"USER_ENTERED",
    requestBody:{
      values:[[
        id,
        body.house,
        body.name,
        body.trash,
        "Y",
        body.join_date
      ]]
    }
  })

  return NextResponse.json({ success:true })
}
