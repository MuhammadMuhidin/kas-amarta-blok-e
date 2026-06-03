"use client";

import { useEffect, useMemo, useState } from "react";

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

function getPersonLabel(person) {
  if (!person) return "";
  return `${person.house || "-"} - ${person.name || "-"}`;
}

function getPersonSearchRank(person, keyword) {
  const house = normalizeSearch(person.house);
  const name = normalizeSearch(person.name);

  if (house === keyword) return 0;
  if (house.startsWith(keyword)) return 1;
  if (name === keyword) return 2;
  if (name.startsWith(keyword)) return 3;
  if (house.includes(keyword)) return 4;
  if (name.includes(keyword)) return 5;

  return 99;
}

export default function PersonSearchBox({
  persons,
  value,
  selectedPerson,
  onChange,
  placeholder = "Search name or house number",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selectedPerson) {
      setQuery(getPersonLabel(selectedPerson));
      return;
    }

    if (!value) setQuery("");
  }, [selectedPerson, value]);

  const keyword = normalizeSearch(query);
  const suggestions = useMemo(() => {
    if (!keyword || selectedPerson) return [];

    return persons
      .map((person) => ({ person, rank: getPersonSearchRank(person, keyword) }))
      .filter((item) => item.rank < 99)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return getPersonLabel(a.person).localeCompare(getPersonLabel(b.person), "id-ID");
      })
      .slice(0, 10)
      .map((item) => item.person);
  }, [persons, keyword, selectedPerson]);

  function selectPerson(person) {
    onChange(person.id);
    setQuery(getPersonLabel(person));
    setOpen(false);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);

    if (value) onChange("");
  }

  return (
    <div style={wrapperStyle}>
      <input
        className="admin-input"
        type="search"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={handleChange}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={placeholder}
      />

      {open && (
        <div style={suggestionBoxStyle}>
          {!keyword ? (
            <div style={emptyStyle}>Type a name or house number.</div>
          ) : suggestions.length === 0 ? (
            <div style={emptyStyle}>Resident not found.</div>
          ) : (
            suggestions.map((person) => (
              <button
                key={person.id}
                type="button"
                style={suggestionItemStyle}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectPerson(person);
                }}
              >
                <span style={houseStyle}>{person.house || "-"}</span>
                <span style={nameStyle}>{person.name || "-"}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const wrapperStyle = {
  position: "relative",
};

const suggestionBoxStyle = {
  position: "absolute",
  zIndex: 20,
  top: "calc(100% + 6px)",
  left: 0,
  right: 0,
  maxHeight: 280,
  overflowY: "auto",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  background: "var(--admin-card)",
  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.16)",
  padding: 6,
};

const suggestionItemStyle = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: 0,
  borderRadius: 10,
  padding: "10px 12px",
  background: "transparent",
  color: "var(--admin-text)",
  cursor: "pointer",
  textAlign: "left",
};

const houseStyle = {
  minWidth: 54,
  fontWeight: 800,
};

const nameStyle = {
  color: "var(--admin-muted)",
  fontWeight: 600,
};

const emptyStyle = {
  padding: "10px 12px",
  color: "var(--admin-muted)",
  fontSize: 13,
  fontWeight: 700,
};