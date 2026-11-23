export type CsvCellValue = string | number | boolean | null | undefined;

function escapeCsvCell(value: CsvCellValue): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsvFile(
  filenameBase: string,
  headers: string[],
  rows: CsvCellValue[][]
): void {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  const csvContent = `\uFEFF${[headerLine, ...bodyLines].join("\r\n")}`;

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${filenameBase}-${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}