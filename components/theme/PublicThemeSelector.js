"use client";

import { useState } from "react";
import usePublicTheme from "@/components/theme/usePublicTheme";

export default function PublicThemeSelector() {
  const { theme, setTheme, options } = usePublicTheme();
  const [open, setOpen] = useState(false);
  const activeTheme = options.find((option) => option.value === theme) || options[0];

  return (
    <>
      <button type="button" className="theme-badge" onClick={() => setOpen(true)}>
        <span>Tampilan</span>
        <strong>{activeTheme.label}</strong>
      </button>

      {open ? (
        <div className="theme-modal-overlay" onClick={() => setOpen(false)}>
          <section className="theme-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="theme-modal-close" onClick={() => setOpen(false)} aria-label="Tutup pilihan tema">
              ×
            </button>
            <div className="theme-modal-kicker">Tampilan</div>
            <h2>Tema</h2>
            <p>Atur tampilan halaman.</p>
            <div className="theme-option-grid">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`theme-option${option.value === theme ? " active" : ""}`}
                  onClick={() => {
                    setTheme(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
