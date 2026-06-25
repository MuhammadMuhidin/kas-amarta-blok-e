import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { dbTable } from "@/lib/dbTable";
import { uploadR2Object } from "@/lib/r2Upload";
import { queuePengaduanNotification } from "@/lib/notificationQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PENGADUAN_TABLE = dbTable("pengaduan");

function clean(value) {
  return String(value ?? "").trim();
}

function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type harus multipart/form-data" },
        { status: 400 },
      );
    }

    const formData = await req.formData();
    const nama = clean(formData.get("nama"));
    const rumah = clean(formData.get("rumah"));
    const kritik = clean(formData.get("kritik"));
    const photo = formData.get("photo");

    const errors = [];
    if (!nama) errors.push("Nama warga wajib diisi");
    if (!rumah) errors.push("Nomor rumah wajib diisi");
    if (!kritik) errors.push("Kritik dan saran wajib diisi");
    if (errors.length) {
      return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
    }

    // Validasi foto jika ada
    if (photo && typeof photo !== "string" && photo.size > 0) {
      if (!photo.type?.startsWith("image/")) {
        return NextResponse.json({ error: "Lampiran harus berupa gambar" }, { status: 400 });
      }
      if (photo.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Ukuran foto maksimal 5 MB" }, { status: 400 });
      }
    }

    let photo_url = null;
    if (photo && typeof photo !== "string" && photo.size > 0) {
      try {
        const uploaded = await uploadR2Object(photo, {
          keyPrefix: "pengaduan-photos",
          fileNamePrefix: `${rumah.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`,
        });
        photo_url = uploaded.url;
      } catch (err) {
        console.error("PENGADUAN UPLOAD ERROR:", err);
        return NextResponse.json(
          { error: "Gagal mengupload foto, coba lagi" },
          { status: 500 },
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(PENGADUAN_TABLE)
      .insert({
        nama,
        rumah,
        kritik,
        photo_url,
        ip_address: getClientIp(req),
      })
      .select("id")
      .single();

    if (error) {
      console.error("PENGADUAN DB ERROR:", JSON.stringify(error));
      const detail = error.message || error.code || error.details || Object.keys(error || {});
      return NextResponse.json({ error: "Gagal menyimpan pengaduan", detail }, { status: 500 });
    }

    let telegramResult = { queued: false, reason: "not_attempted" };
    try {
      telegramResult = await queuePengaduanNotification({
        pengaduan: { id: data?.id, nama, rumah, kritik, created_at: new Date().toISOString() },
        photoUrl: photo_url,
      });
    } catch (err) {
      console.error("PENGADUAN TELEGRAM QUEUE ERROR:", err);
    }

    return NextResponse.json({
      ok: true,
      message: "Pengaduan berhasil dikirim",
      id: data?.id,
      telegram_queue: telegramResult,
    });
  } catch (err) {
    console.error("PENGADUAN ERROR:", err);
    return NextResponse.json(
      { error: err.message || "Terjadi kesalahan" },
      { status: 500 },
    );
  }
}
