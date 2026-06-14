const FIELD_TYPE_LABELS = {
  text: "Text",
  textarea: "Long text",
  number: "Number",
  money: "Currency amount",
  date: "Date",
  tel: "WhatsApp number",
  select: "Dropdown",
  radio: "Radio buttons",
  checkbox: "Yes / No",
  image: "Image upload",
  file: "Document upload",
};

const BASIC_PROPERTIES = [
  ["code", "Code"],
  ["name", "Name"],
  ["category", "Category"],
  ["description", "Description"],
  ["icon", "Icon"],
  ["color", "Color"],
];

function clean(value) {
  return String(value ?? "").trim();
}

function equal(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function short(value, max = 90) {
  const text = clean(value) || "Empty";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function yesNo(value, yes = "Yes", no = "No") {
  return value ? yes : no;
}

function fieldName(field = {}) {
  return clean(field.label) || clean(field.key) || "Unnamed field";
}

function fieldType(value) {
  return FIELD_TYPE_LABELS[value] || value || "Text";
}

function role(value) {
  return clean(value) || "No role";
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
      push(groups, "Information", "change", `${label}: ${short(previous?.[key])} → ${short(current?.[key])}`);
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
      push(groups, "Form", "add", `Added field ${name} (${fieldType(field.type)}, ${field.required ? "required" : "optional"})`);
      return;
    }

    const changes = [
      ["label", "Label", short],
      ["type", "Type", fieldType],
      ["required", "Requirement", (value) => yesNo(value, "Required", "Optional")],
      ["placeholder", "Placeholder", short],
      ["show_summary", "Show in summary", (value) => yesNo(value)],
      ["options", "Options", (value) => (Array.isArray(value) && value.length ? value.join(", ") : "Empty")],
      ["accept", "File types", short],
      ["max_size_mb", "Size limit", (value) => value ? `${value} MB` : "Empty"],
    ];

    changes.forEach(([key, label, formatter]) => {
      if (!equal(old[key], field[key])) {
        push(groups, "Form", "change", `${name} · ${label}: ${formatter(old[key])} → ${formatter(field[key])}`);
      }
    });
  });

  before.forEach((field) => {
    if (!afterMap.has(field.key)) push(groups, "Form", "remove", `Removed field ${fieldName(field)}`);
  });

  const beforeKeys = before.map((field) => field.key);
  const afterKeys = after.map((field) => field.key);
  const sameFieldSet = beforeKeys.length === afterKeys.length && beforeKeys.every((key) => afterMap.has(key));
  if (sameFieldSet) {
    afterKeys.forEach((key, index) => {
      const oldIndex = beforeKeys.indexOf(key);
      if (oldIndex !== index) {
        push(groups, "Form", "change", `Moved field ${fieldName(after[index])}: position ${oldIndex + 1} → ${index + 1}`);
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
      push(groups, "Approval", "add", `Added step ${step}: ${short(next.label)} · ${role(next.role)}`);
      continue;
    }
    if (old && !next) {
      push(groups, "Approval", "remove", `Removed step ${step}: ${short(old.label)} · ${role(old.role)}`);
      continue;
    }

    if (!equal(old.label, next.label)) push(groups, "Approval", "change", `Step ${step} · Name: ${short(old.label)} → ${short(next.label)}`);
    if (!equal(old.role, next.role)) push(groups, "Approval", "change", `Step ${step} · Responsible role: ${role(old.role)} → ${role(next.role)}`);
    if (!equal(old.action, next.action)) push(groups, "Approval", "change", `Step ${step} · Action: ${action(old.action)} → ${action(next.action)}`);
  }
}

function comparePayment(previous, current, groups) {
  if (!equal(previous?.payment_required, current?.payment_required)) {
    push(groups, "Payment", "change", `Payment status: ${yesNo(previous?.payment_required, "Required", "Free")} → ${yesNo(current?.payment_required, "Required", "Free")}`);
  }
  if (!equal(Number(previous?.payment_amount || 0), Number(current?.payment_amount || 0))) {
    push(groups, "Payment", "change", `Amount: Rp${Number(previous?.payment_amount || 0).toLocaleString("id-ID")} → Rp${Number(current?.payment_amount || 0).toLocaleString("id-ID")}`);
  }
  if (!equal(previous?.payment_instruction, current?.payment_instruction)) {
    push(groups, "Payment", "change", `Payment instructions: ${short(previous?.payment_instruction)} → ${short(current?.payment_instruction)}`);
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

export default function MasterVersionHistoryDiff({ previous, version }) {
  if (!previous) {
    return (
      <div className="mm-version-initial">
        <strong>Initial version</strong>
        <span>{(version.fields_schema || []).length} fields · {(version.flow_schema || []).length} steps · {version.payment_required ? `Rp${Number(version.payment_amount || 0).toLocaleString("id-ID")}` : "Free"}</span>
      </div>
    );
  }

  const groups = buildDiff(previous, version);
  const total = groups.reduce((sum, [, changes]) => sum + changes.length, 0);

  if (!total) {
    return <div className="mm-version-no-change">No configuration changes from Version {previous.revision}.</div>;
  }

  return (
    <details className="mm-version-diff">
      <summary>
        <span>View changes from Version {previous.revision}</span>
        <strong>{total} changes</strong>
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
