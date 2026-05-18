import { NextResponse } from "next/server"
import { getDrive } from "@/lib/google"

export const runtime = "nodejs"

export async function GET(){

  try{

    const drive = await getDrive()

    const folderId =
      process.env.GOOGLE_DAILY_BACKUP_FOLDER_ID

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,mimeType,createdTime,modifiedTime)",
      orderBy: "createdTime desc",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const file = res.data.files?.[0]

    if(!file){
      return NextResponse.json({
        ok:false,
        status:"Backup not found",
        name:null,
        created_at:null,
        modified_at:null,
        mime_type:null,
      })
    }

    return NextResponse.json({
      ok:true,
      status:"Backup available",
      name:file.name,
      created_at:new Date(file.createdTime)
        .toLocaleString("id-ID",{
          timeZone:"Asia/Jakarta",
          dateStyle:"medium",
          timeStyle:"short",
        }),
      modified_at:new Date(file.modifiedTime)
        .toLocaleString("id-ID",{
          timeZone:"Asia/Jakarta",
          dateStyle:"medium",
          timeStyle:"short",
        }),
      mime_type:file.mimeType,
    })

  }catch(err){

    return NextResponse.json({
      ok:false,
      status:"Backup check failed",
      error:err.message,
    },{status:500})

  }

}
