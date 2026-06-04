import { NextResponse } from "next/server";
import { getDrive } from "@/lib/google";
import { isAdmin, unauthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    if (!(await isAdmin(req))) {
      return unauthorized();
    }

    const drive = await getDrive();

    const folderId = process.env.GOOGLE_DAILY_BACKUP_FOLDER_ID;

    let files = [];
    let pageToken = null;

    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,

        fields:
          "nextPageToken, files(id,name,mimeType,createdTime,modifiedTime)",

        orderBy: "createdTime desc",

        pageSize: 1000,

        pageToken,

        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      files.push(...(res.data.files || []));

      pageToken = res.data.nextPageToken;
    } while (pageToken);

    const latest = files[0];

    if (!latest) {
      return NextResponse.json({
        ok: false,
        count: 0,
      });
    }

    return NextResponse.json({
      ok: true,

      // count real
      count: files.length,

      name: latest.name,

      created_at: new Date(latest.createdTime).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",

        dateStyle: "medium",

        timeStyle: "short",
      }),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err.message,
      },
      { status: 500 },
    );
  }
}
