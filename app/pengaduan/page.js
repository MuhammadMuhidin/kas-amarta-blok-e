"use client";

import { useState } from "react";
import Toast from "@/components/Toast";
import "@/app/page.css";

const PENGADUAN_API = "/api/pengaduan";

export default function PengaduanPage() {
  const [form, setForm] = useState({ nama: "", rumah: "", kritik: "" });
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState(null);

  function showMessage(text, type = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (file && !file.type.startsWith("image/")) {
      showMessage("File harus berupa gambar", "error");
      e.target.value = "";
      return;
    }
    setPhoto(file);
  }

  function handleRemovePhoto() {
    setPhoto(null);
    const input = document.getElementById("pengaduan-photo");
    if (input) input.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = [];
    if (!form.nama.trim()) errors.push("Nama warga wajib diisi");
    if (!form.rumah.trim()) errors.push("Nomor rumah wajib diisi");
    if (!form.kritik.trim()) errors.push("Kritik dan saran wajib diisi");
    if (errors.length) {
      showMessage(errors.join(". "), "error");
      return;
    }

    try {
      setSubmitting(true);
      setSuccess(false);

      const payload = new FormData();
      payload.append("nama", form.nama.trim());
      payload.append("rumah", form.rumah.trim());
      payload.append("kritik", form.kritik.trim());
      if (photo) {
        payload.append("photo", photo, photo.name);
      }

      const res = await fetch(PENGADUAN_API, { method: "POST", body: payload });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Gagal mengirim pengaduan");

      setSuccess(true);
      setForm({ nama: "", rumah: "", kritik: "" });
      setPhoto(null);
      const input = document.getElementById("pengaduan-photo");
      if (input) input.value = "";
      showMessage("Pengaduan berhasil dikirim");
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="pengaduan-page">
      <style jsx global>{pengaduanPageCss}</style>
      <Toast show={!!message} type={message?.type} message={message?.text} />

      <section className="pengaduan-card pengaduan-success-card" style={{ display: success ? "" : "none" }}>
        <div className="pengaduan-success-panel">
          <div className="pengaduan-success-icon">✓</div>
          <div>
            <strong>Pengaduan berhasil dikirim</strong>
            <p>Terima kasih, pengaduan Anda sudah diterima. Pengurus akan menindaklanjuti.</p>
          </div>
        </div>
      </section>

      <section className="pengaduan-card pengaduan-form-card">
        <div className="pengaduan-card-header">
          <div>
            <span className="pengaduan-kicker">Pengaduan Warga</span>
            <h2>Sampaikan Kritik & Saran</h2>
          </div>
        </div>
        <p className="pengaduan-muted">Semua field wajib diisi kecuali lampiran foto.</p>

        <form onSubmit={handleSubmit} className="pengaduan-form">
          <div className="pengaduan-label">
            <label htmlFor="pengaduan-nama">Nama Warga</label>
            <input
              id="pengaduan-nama"
              className="pengaduan-input"
              type="text"
              placeholder="Nama lengkap"
              value={form.nama}
              onChange={(e) => updateField("nama", e.target.value)}
            />
          </div>

          <div className="pengaduan-label">
            <label htmlFor="pengaduan-rumah">Nomor Rumah</label>
            <input
              id="pengaduan-rumah"
              className="pengaduan-input"
              type="text"
              placeholder="Contoh: A-05"
              value={form.rumah}
              onChange={(e) => updateField("rumah", e.target.value)}
            />
          </div>

          <div className="pengaduan-label">
            <label htmlFor="pengaduan-kritik">Kritik dan Saran</label>
            <textarea
              id="pengaduan-kritik"
              className="pengaduan-input"
              placeholder="Tulis kritik atau saran Anda..."
              value={form.kritik}
              onChange={(e) => updateField("kritik", e.target.value)}
            />
          </div>

          <div className="pengaduan-label">
            <label>Lampiran Foto (opsional)</label>
            <div className="pengaduan-file-field">
              <input
                id="pengaduan-photo"
                className="pengaduan-file-native"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              {photo ? (
                <>
                  <label htmlFor="pengaduan-photo" className="pengaduan-file-picker">
                    <span>�️</span>
                    <div>
                      <strong>{photo.name}</strong>
                      <small>{photo.type} · {photo.size < 1024 * 1024 ? `${Math.ceil(photo.size / 1024)} KB` : `${(photo.size / 1024 / 1024).toFixed(1)} MB`}</small>
                    </div>
                  </label>
                  <button type="button" className="pengaduan-file-remove" onClick={handleRemovePhoto}>
                    Hapus foto
                  </button>
                </>
              ) : (
                <label htmlFor="pengaduan-photo" className="pengaduan-file-picker">
                  <span>📷</span>
                  <div>
                    <strong>Pilih foto</strong>
                    <small>JPG, PNG, WEBP — maks 5 MB</small>
                  </div>
                </label>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="pengaduan-primary-btn"
            disabled={submitting}
          >
            {submitting ? "Mengirim..." : "Kirim Pengaduan"}
          </button>
        </form>
      </section>
    </main>
  );
}

const pengaduanPageCss = `
body:has(.pengaduan-page){background:var(--bg)!important;color:var(--text);font-family:Inter,Arial,sans-serif;font-size:var(--font-base)}.pengaduan-page{width:100%;max-width:1060px;margin:0 auto;padding:12px 10px calc(104px + env(safe-area-inset-bottom,0px));font-family:Inter,Arial,sans-serif;font-size:var(--font-base);color:var(--text)}
`;
