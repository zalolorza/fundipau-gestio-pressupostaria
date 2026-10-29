export type XlsxCell = string | number | boolean | null | undefined

export type XlsxSheet = {
  name: string
  rows: XlsxCell[][]
}

/** Part de nom d'arxiu: minúscules, sense accents, guions. */
export function slugifyFilePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "arxiu"
}

export function periodFilePart(from: string, to: string) {
  const a = from.slice(0, 7).replace("-", "")
  const b = to.slice(0, 7).replace("-", "")
  return a === b ? a : `${a}-${b}`
}

export async function downloadWorkbook({
  filename,
  sheets,
}: {
  filename: string
  sheets: XlsxSheet[]
}) {
  const ExcelJS = (await import("exceljs")).default
  const wb = new ExcelJS.Workbook()
  wb.creator = "Fundipau"

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.name.slice(0, 31))
    for (const row of sheet.rows) {
      ws.addRow(row.map((c) => (c == null ? "" : c)))
    }
    const header = ws.getRow(1)
    if (sheet.rows.length > 0) {
      header.font = { bold: true }
    }
    ws.columns.forEach((col) => {
      let max = 10
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = String(cell.value ?? "").length
        if (len > max) max = Math.min(len, 48)
      })
      col.width = max + 2
    })
  }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
