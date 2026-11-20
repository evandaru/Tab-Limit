// Pure helpers for Secure Pages: clipboard CSV/TSV parsing and link handling.
// Kept free of DOM access so it can be unit-tested on its own.

// Minimal RFC4180-ish parser: quoted cells, escaped quotes, embedded newlines,
// and both comma (CSV) and tab (TSV, i.e. a copy/paste out of Google Sheets).
export function parseDelimited(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  return rows.filter((r) => r.some((value) => value.trim() !== ""));
}

// Picks the separator automatically: a tab wins when present, otherwise comma.
export function detectDelimiter(text) {
  return text.includes("\t") ? "\t" : ",";
}

export function delimitedToTable(text) {
  const rows = parseDelimited(text, detectDelimiter(text));
  if (!rows.length) return null;
  const [header, ...body] = rows;
  const width = header.length;
  const columns = header.map((name, index) => name.trim() || `Column ${index + 1}`);
  const rowsPadded = body.map((row) => [
    ...row,
    ...Array(Math.max(0, width - row.length)),
  ].slice(0, width));
  return { columns, rows: rowsPadded };
}

export function tableToDelimited(table, delimiter = ",") {
  const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [table.columns.map(escapeCell).join(delimiter)];
  table.rows.forEach((row) => {
    lines.push(table.columns.map((_, c) => escapeCell(row[c])).join(delimiter));
  });
  return lines.join("\n");
}

// Google only serves a frameable URL for sheets published to the web, so
// /edit is rewritten to /preview and every `uid=` param to `gid=` (that is the
// tab id Sheets expects in an embed).
export function toEmbedUrl(url) {
  return url
    .replace(/\/edit(\?.*)?$/, "/preview$1")
    .replace(/([?&])uid=/, "$1gid=");
}