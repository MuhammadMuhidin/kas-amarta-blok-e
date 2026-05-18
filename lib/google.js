import { google } from "googleapis"

const spreadsheetId = process.env.SPREADSHEET_ID

export async function getSheets(){

  const auth = new google.auth.GoogleAuth({
    credentials:{
      client_email:process.env.GOOGLE_CLIENT_EMAIL,
      private_key:process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,"\n")
    },
    scopes:["https://www.googleapis.com/auth/spreadsheets"]
  })

  const client = await auth.getClient()

  return google.sheets({
    version:"v4",
    auth:client
  })
}

export async function getSheetData() {
  try {
    const sheets = await getSheets();

    const [personalRes, paymentRes, cashflowRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Personal!A:F",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Payment!A:G",
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Cashflow!A:F",
      }),
    ]);

    /* ========================= */
    /* PERSONAL */
    /* ========================= */
    const personal = (personalRes.data.values || [])
      .slice(1)
      .map((r) => ({
        __type: "personal",
        id: r[0],
        house: r[1],
        name: r[2],
        trash: r[3],
        active: r[4],
        join_date: r[5],
      }));

    /* ========================= */
    /* PAYMENT */
    /* ========================= */
    const payment = (paymentRes.data.values || [])
      .slice(1)
      .map((r) => ({
        __type: "payment",
        id: r[0],
        person_id: r[1],
        person_house: r[2],
        person_name: r[3],
        period: r[4],
        amount: Number(r[5]) || 0,
        date: r[6],
      }));

    /* ========================= */
    /* CASHFLOW */
    /* ========================= */
    const cashflow = (cashflowRes.data.values || [])
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
      
    return [...personal, ...payment, ...cashflow];

  } catch (err) {
    console.error("GOOGLE ERROR:", err);
    return [];
  }
}

export async function getDrive(){

  const auth = new google.auth.GoogleAuth({
    credentials:{
      client_email:process.env.GOOGLE_CLIENT_EMAIL,
      private_key:process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,"\n")
    },
    scopes:[
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  })

  const client = await auth.getClient()

  return google.drive({
    version:"v3",
    auth:client
  })
}
