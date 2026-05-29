"use client";

import usePublicTheme from "@/components/theme/usePublicTheme";

export default function PublicThemeSelector() {
  const { theme, setTheme, options } = usePublicTheme();

  return (
    <div className="theme-selector" aria-label="Pilih tema tampilan">
      <span>Pilih tema</span>
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
