const fs = require('fs');
const path = require('path');

function buildPdf(title, author, numPages) {
  const objects = [];
  
  // Object 1: Catalog
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);

  // We will build page object references
  const pageRefs = [];
  for (let i = 0; i < numPages; i++) {
    pageRefs.push(`${4 + i * 2} 0 R`);
  }

  // Object 2: Pages
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [ ${pageRefs.join(' ')} ] /Count ${numPages} >>\nendobj`);

  // Object 3: Font
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  for (let i = 1; i <= numPages; i++) {
    const pageObjId = 4 + (i - 1) * 2;
    const streamObjId = pageObjId + 1;

    // Stream text content
    const chapterNum = Math.ceil(i / 3);
    const textLines = [
      `BT`,
      `/F1 24 Tf`,
      `50 720 Td`,
      `(${title}) Tj`,
      `0 -30 Td`,
      `/F1 14 Tf`,
      `(By ${author}) Tj`,
      `0 -40 Td`,
      `/F1 18 Tf`,
      `(Chapter ${chapterNum}: Reading Page ${i}) Tj`,
      `0 -30 Td`,
      `/F1 12 Tf`,
      `(This is page ${i} of ${numPages} in ${title}.) Tj`,
      `0 -20 Td`,
      `(Welcome to your personal Kindle-like reading experience.) Tj`,
      `0 -20 Td`,
      `(Your reading position is automatically tracked and synchronized across devices.) Tj`,
      `0 -20 Td`,
      `(Add bookmarks, adjust brightness, change themes, or zoom freely.) Tj`,
      `0 -40 Td`,
      `(Page ${i} / ${numPages}) Tj`,
      `ET`
    ];

    const streamText = textLines.join('\n');
    const streamLen = Buffer.byteLength(streamText);

    // Page object
    objects.push(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${streamObjId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj`);

    // Content stream object
    objects.push(`${streamObjId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj`);
  }

  // Calculate offsets for xref table
  let pdfContent = `%PDF-1.4\n`;
  const offsets = [];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdfContent));
    pdfContent += obj + '\n';
  }

  const xrefStart = Buffer.byteLength(pdfContent);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    xref += String(offset).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return pdfContent + xref + trailer;
}

const bookDir = path.join(__dirname, '..', 'public', 'book');
if (!fs.existsSync(bookDir)) {
  fs.mkdirSync(bookDir, { recursive: true });
}

const sampleBooks = [
  { fileName: 'atomic-habits.pdf', title: 'Atomic Habits', author: 'James Clear', pages: 20 },
  { fileName: 'deep-work.pdf', title: 'Deep Work', author: 'Cal Newport', pages: 15 },
  { fileName: 'the-psychology-of-money.pdf', title: 'The Psychology of Money', author: 'Morgan Housel', pages: 18 },
  { fileName: 'rich-dad-poor-dad.pdf', title: 'Rich Dad Poor Dad', author: 'Robert T. Kiyosaki', pages: 12 }
];

for (const book of sampleBooks) {
  const filePath = path.join(bookDir, book.fileName);
  if (!fs.existsSync(filePath)) {
    const pdfData = buildPdf(book.title, book.author, book.pages);
    fs.writeFileSync(filePath, pdfData, 'binary');
    console.log(`Created sample PDF: ${book.fileName}`);
  }
}
