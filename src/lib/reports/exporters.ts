import * as XLSX from "xlsx";

export type ReportTable = {
  title: string;
  rows: unknown[][];
};

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string"
        ? value
        : String(value);

  if (/[",\n;]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function escapePdfText(value: unknown) {
  const normalized =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);

  return normalized
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .slice(0, 110);
}

function chunkRows(rows: unknown[][], pageSize: number) {
  const chunks: unknown[][][] = [];
  for (let index = 0; index < rows.length; index += pageSize) {
    chunks.push(rows.slice(index, index + pageSize));
  }
  return chunks;
}

export function buildCsv(rows: unknown[][]) {
  return rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(";"))
    .join("\n");
}

export function buildXlsxBuffer(table: ReportTable) {
  const worksheet = XLSX.utils.aoa_to_sheet(table.rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Relatorio");

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer",
  }) as Buffer;
}

export function buildPdfBuffer(table: ReportTable) {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 40;
  const titleY = 800;
  const lineHeight = 16;
  const rowsPerPage = 38;
  const chunks = chunkRows(table.rows, rowsPerPage);
  const pageObjectIds = chunks.map((_, index) => 5 + index * 2);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageObjectIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] /Count ${pageObjectIds.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  for (const [pageIndex, rows] of chunks.entries()) {
    const lines = [
      "BT",
      "/F1 15 Tf",
      `${marginX} ${titleY} Td`,
      `(${escapePdfText(table.title)}) Tj`,
      "/F1 8 Tf",
      `0 -${lineHeight * 1.8} Td`,
      `(Gerado em ${new Date().toISOString().slice(0, 19)}) Tj`,
      `0 -${lineHeight * 1.4} Td`,
    ];

    for (const row of rows) {
      const text = row.map((cell) => escapePdfText(cell)).join(" | ");
      lines.push(`(${text}) Tj`);
      lines.push(`0 -${lineHeight} Td`);
    }

    lines.push(
      "/F1 8 Tf",
      `${pageWidth - marginX * 2} ${-(pageHeight - 64)} Td`,
      `(Pagina ${pageIndex + 1}/${chunks.length}) Tj`,
      "ET",
    );

    const stream = lines.join("\n");
    const streamId = 4 + pageIndex * 2;
    const pageId = 5 + pageIndex * 2;
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    );
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
    );
    void pageId;
  }

  const pdfObjects = objects.map((content, index) => `${index + 1} 0 obj\n${content}\nendobj`);
  let offset = "%PDF-1.4\n".length;
  const xrefOffsets = ["0000000000 65535 f "];

  for (const object of pdfObjects) {
    xrefOffsets.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += Buffer.byteLength(`${object}\n`, "latin1");
  }

  const body = `%PDF-1.4\n${pdfObjects.join("\n")}\n`;
  const xrefPosition = Buffer.byteLength(body, "latin1");
  const xref = [
    "xref",
    `0 ${pdfObjects.length + 1}`,
    ...xrefOffsets,
    "trailer",
    `<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefPosition),
    "%%EOF",
  ].join("\n");

  return Buffer.from(`${body}${xref}`, "latin1");
}

function toResponseBody(buffer: Buffer) {
  return new Uint8Array(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer,
  );
}

export function buildExportResponse(input: {
  table: ReportTable;
  format: "csv" | "xlsx" | "pdf";
  filenameBase: string;
}) {
  if (input.format === "xlsx") {
    const buffer = buildXlsxBuffer(input.table);
    return new Response(toResponseBody(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${input.filenameBase}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (input.format === "pdf") {
    const buffer = buildPdfBuffer(input.table);
    return new Response(toResponseBody(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${input.filenameBase}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(buildCsv(input.table.rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${input.filenameBase}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
