"use client";

import { readJson } from "@/components/admin/adminClientApi";
import { ADMIN_ACCESS_ROLES } from "@/lib/adminRoles";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const API = "/api/admin/approval-masters";

const FIELD_TYPE_LABELS = {
  text: "Teks",
  textarea: "Teks panjang",
  number: "Nomor",
  money: "Nominal uang",
  date: "Tanggal",
  tel: "Nomor WhatsApp",
  select: "Pilihan dropdown",
  radio: "Pilihan radio",
  checkbox: "Ya / Tidak",
  image: "Upload gambar",
  file: "Upload dokumen",
};

function clean(value) {
  return String(value || "").trim();
}

function roleLabel(value) {
  return ADMIN_ACCESS_ROLES.find((role) => role.value === value)?.label || value || "Pengurus";
}

function money(value) {
  return `Rp${Number(value || 0).toLocaleString("id-ID")}`;
}

function previewField(field) {
  const options = Array.isArray(field.options) ? field.options.filter(Boolean) : [];
  const type = field.type || "text";

  if (type === "textarea") return <textarea rows={3} placeholder={field.placeholder || field.label} disabled />;
  if (type === "select") return <select disabled><option>{field.placeholder || "Pilih salah satu"}</option>{options.map((option) => <option key={option}>{option}</option>)}</select>;
  if (type === "radio") return <div className="mm-ro-options">{options.map((option) => <label key={option}><input type="radio" disabled /> {option}</label>)}</div>;
  if (type === "checkbox") return <label className="mm-ro-check"><input type="checkbox" disabled /> Ya</label>;
  if (["image", "file"].includes(type)) {
    return (
      <div className="mm-ro-file">
        <span>{type === "image" ? "🖼️" : "📎"}</span>
        <div><strong>Pilih {type === "image" ? "gambar" : "dokumen"}</strong><small>Maksimal {field.max_size_mb || (type === "image" ? 5 : 10)} MB</small></div>
      </div>
    );
  }

  const inputType = type === "money" ? "number" : ["number", "date", "tel"].includes(type) ? type : "text";
  return <input type={inputType} placeholder={field.placeholder || field.label} disabled />;
}

function PreviewContent({ config }) {
  return (
    <div className="mm-ro-layout">
      <section className="mm-ro-card">
        <div className="mm-ro-title">
          <span style={{ background: config.color || "#2563eb" }}>{config.icon || "📄"}</span>
          <div><small>{config.category || "Umum"}</small><h3>{config.name || "Nama Pengajuan"}</h3></div>
        </div>
        {config.description ? <p className="mm-ro-description">{config.description}</p> : null}
        {config.payment_required ? (
          <div className="mm-ro-payment"><small>Biaya Pengajuan</small><strong>{money(config.payment_amount)}</strong>{config.payment_instruction ? <p>{config.payment_instruction}</p> : null}</div>
        ) : <div className="mm-ro-free">Tanpa biaya</div>}
        <div className="mm-ro-form">
          {(config.fields_schema || []).map((field, index) => (
            <label key={`${field.key || field.label}-${index}`}>
              <span>{field.label || `Field ${index + 1}`}{field.required ? " *" : ""}</span>
              <small>{FIELD_TYPE_LABELS[field.type] || field.type || "Teks"}{field.required ? " · Wajib" : " · Opsional"}</small>
              {previewField(field)}
            </label>
          ))}
          <button type="button" disabled>Kirim Pengajuan</button>
        </div>
      </section>

      <section className="mm-ro-card">
        <div className="mm-ro-kicker">Alur Persetujuan</div>
        <div className="mm-ro-flow">
          <div><span>✓</span><p><strong>Pengajuan dibuat</strong><small>Data diterima sistem</small></p></div>
          {(config.flow_schema || []).map((step, index) => (
            <div key={`${step.role}-${index}`}><span>{index + 1}</span><p><strong>{step.label || "Tahap persetujuan"}</strong><small>{roleLabel(step.role)}</small></p></div>
          ))}
          <div><span>✓</span><p><strong>Selesai</strong><small>{config.flow_schema?.length ? "Setelah seluruh tahap diproses" : "Langsung selesai"}</small></p></div>
        </div>
      </section>
    </div>
  );
}

function findMaster(masters, card) {
  const name = clean(card?.querySelector(".mm-master-title-row h4")?.textContent);
  return (masters || []).find((master) => clean(master.name) === name) || null;
}

function findPreviewButton(actions) {
  return [...(actions?.querySelectorAll("button") || [])].find((button) => {
    const text = clean(button.textContent);
    return button.dataset.mmPreviewPrimary === "true" || text === "Preview" || text === "Preview Draft" || text === "Lihat Versi Aktif";
  });
}

export default function MasterManagementReadOnlyPreview() {
  const [masters, setMasters] = useState([]);
  const [preview, setPreview] = useState(null);
  const mastersRef = useRef([]);

  useEffect(() => {
    mastersRef.current = masters;
  }, [masters]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const payload = await readJson(API);
        if (active) setMasters(payload?.masters || []);
      } catch {
        if (active) setMasters([]);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let timer;

    function enhance() {
      const cards = [...document.querySelectorAll(".mm-master-card")];
      cards.forEach((card) => {
        const master = findMaster(mastersRef.current, card);
        const actions = card.querySelector(".mm-master-actions");
        if (!master || !actions) return;

        const primary = findPreviewButton(actions);
        if (!primary) return;

        const primaryKind = master.has_draft ? "draft" : "active";
        const primaryLabel = master.has_draft ? "Preview Draft" : "Lihat Versi Aktif";
        primary.dataset.mmPreviewPrimary = "true";
        if (primary.dataset.mmPreviewKind !== primaryKind) primary.dataset.mmPreviewKind = primaryKind;
        if (clean(primary.textContent) !== primaryLabel) primary.textContent = primaryLabel;

        const existingActive = actions.querySelector('[data-mm-preview-secondary="true"]');
        if (master.has_draft && master.published_config) {
          if (!existingActive) {
            const activeButton = document.createElement("button");
            activeButton.type = "button";
            activeButton.className = "admin-small-btn";
            activeButton.dataset.mmPreviewSecondary = "true";
            activeButton.dataset.mmPreviewKind = "active";
            activeButton.textContent = "Lihat Versi Aktif";
            primary.insertAdjacentElement("afterend", activeButton);
          }
        } else if (existingActive) {
          existingActive.remove();
        }
      });
    }

    function schedule() {
      clearTimeout(timer);
      timer = window.setTimeout(enhance, 40);
    }

    enhance();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [masters]);

  useEffect(() => {
    function handleClick(event) {
      const button = event.target.closest?.("[data-mm-preview-kind]");
      if (!button) return;

      const card = button.closest(".mm-master-card");
      const master = findMaster(mastersRef.current, card);
      if (!master) return;

      event.preventDefault();
      event.stopPropagation();

      const kind = button.dataset.mmPreviewKind === "draft" ? "draft" : "active";
      const config = kind === "active" ? master.published_config : master;
      if (!config) return;

      setPreview({ master, kind, config });
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (!preview) return undefined;
    function onKey(event) {
      if (event.key === "Escape") setPreview(null);
    }
    document.body.classList.add("mm-ro-modal-open");
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("mm-ro-modal-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [preview]);

  const badge = useMemo(() => {
    if (!preview) return "";
    if (preview.kind === "draft") return `Draft v${preview.master.draft_revision || preview.config.revision || "-"} · Belum dipublikasikan`;
    return `Versi Aktif v${preview.master.published_revision || preview.config.revision || "-"}`;
  }, [preview]);

  function openEditor() {
    const name = clean(preview?.master?.name);
    const card = [...document.querySelectorAll(".mm-master-card")].find((item) => clean(item.querySelector(".mm-master-title-row h4")?.textContent) === name);
    const editButton = [...(card?.querySelectorAll(".mm-master-actions button") || [])].find((button) => clean(button.textContent).startsWith("Edit"));
    setPreview(null);
    window.setTimeout(() => editButton?.click(), 0);
  }

  if (!preview || typeof document === "undefined") return null;

  return createPortal(
    <div className="mm-ro-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
      <section className="mm-ro-modal" role="dialog" aria-modal="true" aria-label={`Preview ${preview.master.name}`}>
        <header className="mm-ro-header">
          <div><span className={preview.kind === "draft" ? "is-draft" : "is-active"}>{badge}</span><h2>Preview Read-only</h2><p>Periksa tampilan warga dan alur persetujuan tanpa mengubah konfigurasi.</p></div>
          <button type="button" className="mm-ro-close" onClick={() => setPreview(null)} aria-label="Tutup preview">×</button>
        </header>
        <div className="mm-ro-body"><PreviewContent config={preview.config} /></div>
        <footer className="mm-ro-footer">
          <button type="button" className="admin-small-btn" onClick={() => setPreview(null)}>Tutup</button>
          <button type="button" className="admin-btn" onClick={openEditor}>{preview.master.has_draft ? "Edit Draft" : "Edit"}</button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
