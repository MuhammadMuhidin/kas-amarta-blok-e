import { NextResponse } from "next/server"
import { getSheets } from "@/lib/google"
import { generateId } from "@/lib/id"

export const dynamic = "force-dynamic"

const spreadsheetId = process.env.SPREADSHEET_ID

function verifyCSRF(req) {
  const csrfCookie =
    req.cookies.get("csrf_token")?.value;

  const csrfHeader =
    req.headers.get("x-csrf-token");

  return (
    csrfCookie &&
    csrfHeader &&
    csrfCookie === csrfHeader
  );
}

export async function GET(){

  const sheets = await getSheets()

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range:"personal!A:F"
  })

  const rows = res.data.values || []

  const data = rows.slice(1).map(r=>({
    id:r[0],
    house:r[1],
    name:r[2],
    trash:r[3],
    active:r[4],
    join_date:r[5]
  }))

  return NextResponse.json(data)
}

export async function POST(req){

  const body = await req.json()

  const sheets = await getSheets()

  const id = generateId()

  // verification CSRF
  if (!verifyCSRF(req)) {
    return Response.json(
      { error: "Invalid CSRF" },
      { status: 403 }
    );
  }
  
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
