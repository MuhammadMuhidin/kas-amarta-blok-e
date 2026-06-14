"use client";

import { readJson } from "@/components/admin/adminClientApi";
import { useEffect, useState } from "react";
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

const BASIC_PROPERTIES = [
  ["code", "Kode"],
  ["name", "Nama"],
  ["category", "Kategori"],
  ["description", "Deskripsi"],
  ["icon", "Ikon"],
  ["color", "Warna"],
];

function clean(value) {
  return String(value ?? "").trim();
}

function equal(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function short(value, max = 90) {
  const text = clean(value) || "Kosong";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function bool(value, yes = "Ya", no = "Tidak") {
  return value ? yes : no;
}

function fieldName(field = {}) {
  return clean(field.label) || clean(field.key) || "Field tanpa nama";
}

function fieldType(value) {
  return FIELD_TYPE_LABELS[value] || value || "Teks";
}

function role(value) {
  return clean(value) || "Tanpa role";
}

function action(value) {
  return clean(value).replace(/_/g, " ") || "approve";
}

function push(groups, group, kind, text) {
  if (!groups[group]) groups[group] = [];
  groups[group].push({ kind, text });
}

function compareBasic(previous, current, groups) {
  BASIC_PROPERTIES.forEach(([key, label]) => {
    if (!equal(previous?.[key], current?.[key])) {
      push(groups, "Informasi", "change", `${label}: ${short(previous?.[key])} → ${short(current?.[key])}`);
    }
  });
}

function compareFields(previous, current, groups) {
  const before = Array.isArray(previous?.fields_schema) ? previous.fields_schema : [];
  const after = Array.isArray(current?.fields_schema) ? current.fields_schema : [];
  const beforeMap = new Map(before.map((field) => [field.key, field]));
  const afterMap = new Map(after.map((field) => [field.key, field]));

  after.forEach((field) => {
    const old = beforeMap.get(field.key);
    const name = fieldName(field);
    if (!old) {
      push(groups, "Formulir", "add", `Menambahkan field ${name} (${fieldType(field.type)}, ${field.required ? "wajib" : "opsional"})`);
      return;
    }

    const changes = [
      ["label", "Label", short],
      ["type", "Tipe", fieldType],
      ["required", "Status wajib", (value) => bool(value, "Wajib", "Opsional")],
      ["placeholder", "Placeholder", short],
      ["show_summary", "Tampil di ringkasan", (value) => bool(value)],
      ["options", "Pilihan", (value) => (Array.isArray(value) && value.length ? value.join(", ") : "Kosong")],
      ["accept", "Format file", short],
      ["max_size_mb", "Batas ukuran", (value) => value ? `${value} MB` : "Kosong"],
    ];

    changes.forEach(([key, label, formatter]) => {
      if (!equal(old[key], field[key])) {
        push(groups, "Formulir", "change", `${name} · ${label}: ${formatter(old[key])} → ${formatter(field[key])}`);
      }
    });
  });

  before.forEach((field) => {
    if (!afterMap.has(field.key)) push(groups, "Formulir", "remove", `Menghapus field ${fieldName(field)}`);
  });

  const beforeKeys = before.map((field) => field.key);
  const afterKeys = after.map((field) => field.key);
  const sameFieldSet = beforeKeys.length === afterKeys.length && beforeKeys.every((key) => afterMap.has(key));
  if (sameFieldSet) {
    afterKeys.forEach((key, index) => {
      const oldIndex = beforeKeys.indexOf(key);
      if (oldIndex !== index) {
        push(groups, "Formulir", "change", `Memindahkan field ${fieldName(after[index])}: urutan ${oldIndex + 1} → ${index + 1}`);
      }
    });
  }
}

function compareFlow(previous, current, groups) {
  const before = Array.isArray(previous?.flow_schema) ? previous.flow_schema : [];
  const after = Array.isArray(current?.flow_schema) ? current.flow_schema : [];
  const total = Math.max(before.length, after.length);

  for (let index = 0; index < total; index += 1) {
    const old = before[index];
    const next = after[index];
    const step = index + 1;

    if (!old && next) {
      push(groups, "Approval", "add", `Menambahkan tahap ${step}: ${short(next.label)} · ${role(next.role)}`);
      continue;
    }
    if (old && !next) {
      push(groups, "Approval", "remove", `Menghapus tahap ${step}: ${short(old.label)} · ${role(old.role)}`);
      continue;
    }

    if (!equal(old.label, next.label)) push(groups, "Approval", "change", `Tahap ${step} · Nama: ${short(old.label)} → ${short(next.label)}`);
    if (!equal(old.role, next.role)) push(groups, "Approval", "change", `Tahap ${step} · Penanggung jawab: ${role(old.role)} → ${role(next.role)}`);
    if (!equal(old.action, next.action)) push(groups, "Approval", "change", `Tahap ${step} · Tindakan: ${action(old.action)} → ${action(next.action)}`);
  }
}

function comparePayment(previous, current, groups) {
  if (!equal(previous?.payment_required, current?.payment_required)) {
    push(groups, "Pembayaran", "change", `Status pembayaran: ${bool(previous?.payment_required, "Berbayar", "Gratis")} → ${bool(current?.payment_required, "Berbayar", "Gratis")}`);
  }
  if (!equal(Number(previous?.payment_amount || 0), Number(current?.payment_amount || 0))) {
    push(groups, "Pembayaran", "change", `Nominal: Rp${Number(previous?.payment_amount || 0).toLocaleString("id-ID")} → Rp${Number(current?.payment_amount || 0).toLocaleString("id-ID")}`);
  }
  if (!equal(previous?.payment_instruction, current?.payment_instruction)) {
    push(groups, "Pembayaran", "change", `Instruksi pembayaran: ${short(previous?.payment_instruction)} → ${short(current?.payment_instruction)}`);
  }
}

function buildDiff(previous, current) {
  const groups = {};
  compareBasic(previous, current, groups);
  compareFields(previous, current, groups);
  compareFlow(previous, current, groups);
  comparePayment(previous, current, groups);
  return Object.entries(groups).filter(([, changes]) => changes.length);
}

function VersionDiff({ previous, version }) {
  if (!previous) {
    return (
      <div className="mm-version-initial">
        <strong>Versi awal</strong>
        <span>{(version.fields_schema || []).length} field · {(version.flow_schema || []).length} tahap · {version.payment_required ? `Rp${Number(version.payment_amount || 0).toLocaleString("id-ID")}` : "Gratis"}</span>
      </div>
    );
  }

  const groups = buildDiff(previous, version);
  const total = groups.reduce((sum, [, changes]) => sum + changes.length, 0);

  if (!total) {
    return <div className="mm-version-no-change">Tidak ada perubahan konfigurasi dari Versi {previous.revision}.</div>;
  }

  return (
    <details className="mm-version-diff">
      <summary>
        <span>Lihat perubahan dari Versi {previous.revision}</span>
        <strong>{total} perubahan</strong>
      </summary>
      <div className="mm-version-diff-body">
        {groups.map(([group, changes]) => (
          <section key={group}>
            <h5>{group}</h5>
            <div className="mm-version-change-list">
              {changes.map((change, index) => (
                <div className={`mm-version-change mm-version-change-${change.kind}`} key={`${group}-${index}`}>
                  <span>{change.kind === "add" ? "+" : change.kind === "remove" ? "−" : "~"}</span>
                  <p>{change.text}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
}

function readRevision(item) {
  const text = item.querySelector("strong")?.textContent || "";
  const match = text.match(/Versi\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function findMaster(masters, name, revisions) {
  const candidates = (masters || []).filter((master) => clean(master.name) === clean(name));
  if (candidates.length <= 1) return candidates[0] || null;
  const requested = new Set(revisions);
  return candidates.find((master) => {
    const available = new Set((master.version_history || []).map((version) => Number(version.revision || 0)));
    return [...requested].every((revision) => available.has(revision));
  }) || candidates[0];
}

export default function MasterVersionHistoryDiff() {
  const [context, setContext] = useState({ key: "", name: "", revisions: [] });
  const [masters, setMasters] = useState([]);
  const [targets, setTargets] = useState([]);

  useEffect(() => {
    let timer;
    const scan = () => {
      const editor = document.querySelector(".mm-editor");
      const name = clean(editor?.querySelector(".mm-editor-head .activity-title")?.textContent);
      const revisions = [...(editor?.querySelectorAll(".mm-history-item") || [])].map(readRevision).filter(Boolean);
      const key = name && revisions.length ? `${name}|${revisions.join(",")}` : "";
      setContext((previous) => previous.key === key ? previous : { key, name, revisions });
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(scan, 60);
    };
    scan();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!context.key) {
      setMasters([]);
      return undefined;
    }
    let active = true;
    readJson(API)
      .then((payload) => {
        if (active) setMasters(payload?.masters || []);
      })
      .catch(() => {
        if (active) setMasters([]);
      });
    return () => {
      active = false;
    };
  }, [context.key]);

  useEffect(() => {
    const editor = document.querySelector(".mm-editor");
    const master = findMaster(masters, context.name, context.revisions);
    if (!editor || !master) {
      setTargets([]);
      return undefined;
    }

    const versions = [...(master.version_history || [])].sort((left, right) => Number(left.revision || 0) - Number(right.revision || 0));
    const byRevision = new Map(versions.map((version) => [Number(version.revision || 0), version]));
    const items = [...editor.querySelectorAll(".mm-history-item")];
    const nextTargets = [];

    items.forEach((item) => {
      const revision = readRevision(item);
      const version = byRevision.get(revision);
      if (!version) return;
      const previous = [...versions].reverse().find((candidate) => Number(candidate.revision || 0) < revision) || null;
      const slot = document.createElement("div");
      slot.className = "mm-version-diff-slot";
      item.classList.add("mm-history-item-with-diff");
      item.appendChild(slot);
      nextTargets.push({ node: slot, revision, version, previous });
    });

    setTargets(nextTargets);
    return () => {
      nextTargets.forEach(({ node }) => {
        node.parentElement?.classList.remove("mm-history-item-with-diff");
        node.remove();
      });
    };
  }, [masters, context.key, context.name, context.revisions]);

  return (
    <>
      <style jsx global>{`
        .mm-history-item-with-diff{flex-wrap:wrap;gap:10px}
        .mm-version-diff-slot{flex:0 0 100%;width:100%;padding-top:10px;border-top:1px solid var(--admin-border,#dbe3ee)}
        .mm-version-initial,.mm-version-no-change{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 12px;border-radius:10px;background:var(--admin-soft-bg,rgba(148,163,184,.10));font-size:12px}
        .mm-version-initial span,.mm-version-no-change{color:var(--admin-muted,#64748b)}
        .mm-version-diff{width:100%}
        .mm-version-diff>summary{display:flex;justify-content:space-between;gap:12px;align-items:center;cursor:pointer;padding:10px 12px;border-radius:10px;background:var(--admin-soft-bg,rgba(148,163,184,.10));font-size:12px;font-weight:700}
        .mm-version-diff>summary strong{font-size:11px;color:#2563eb}
        .mm-version-diff-body{display:grid;gap:12px;padding:12px 4px 2px}
        .mm-version-diff-body section{display:grid;gap:7px}
        .mm-version-diff-body h5{margin:0;font-size:12px;color:var(--admin-text,#0f172a)}
        .mm-version-change-list{display:grid;gap:6px}
        .mm-version-change{display:grid;grid-template-columns:22px 1fr;gap:7px;align-items:start;padding:8px 10px;border:1px solid var(--admin-border,#dbe3ee);border-radius:9px;background:var(--admin-card,#fff)}
        .mm-version-change>span{display:grid;place-items:center;width:20px;height:20px;border-radius:6px;font-weight:800;font-size:13px}
        .mm-version-change p{margin:1px 0 0;font-size:12px;line-height:1.45;color:var(--admin-text,#0f172a);overflow-wrap:anywhere}
        .mm-version-change-add>span{background:rgba(34,197,94,.14);color:#15803d}
        .mm-version-change-remove>span{background:rgba(239,68,68,.14);color:#b91c1c}
        .mm-version-change-change>span{background:rgba(37,99,235,.14);color:#1d4ed8}
        @media(max-width:640px){.mm-version-initial,.mm-version-no-change,.mm-version-diff>summary{align-items:flex-start;flex-direction:column}.mm-version-diff>summary strong{margin-left:0}}
      `}</style>
      {targets.map((target) => createPortal(
        <VersionDiff previous={target.previous} version={target.version} />,
        target.node,
        `master-version-diff-${target.revision}`,
      ))}
    </>
  );
}
