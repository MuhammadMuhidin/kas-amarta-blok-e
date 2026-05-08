import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"
import { generateId } from "@/lib/id"

const spreadsheetId = process.env.SPREADSHEET_ID

export async function POST(req){

  try{

    const body = await req.json()

    const sheets = await getSheets()

    const trashId = generateId("TRASH-")

    const today =
      new Date().toISOString().slice(0,10)

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range:"trash!A:D",
      valueInputOption:"USER_ENTERED",
      requestBody:{
        values:[[
          trashId,
          body.payment_id,
          body.amount,
          today
        ]]
      }
    })

    return NextResponse.json({
      success:true,
      trash_id:trashId
    })

  }catch(err){

    return NextResponse.json(
      {
        success:false,
        error:err.message
      },
      {
        status:500
      }
    )

  }
}