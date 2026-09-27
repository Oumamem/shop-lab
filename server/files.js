// Small, dependency-free generators for the files the app serves: product images (SVG),
// invoices (PDF) and CSV import/export.

const escapeXml = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

export function productSvg(product, index) {
  const hue = (product.id * 47 + index * 25) % 360;
  const shapes = [
    `<circle cx="300" cy="250" r="130" fill="hsl(${hue},45%,55%)"/>`,
    `<rect x="170" y="120" width="260" height="260" rx="32" fill="hsl(${hue},45%,55%)"/>`,
    `<polygon points="300,100 450,380 150,380" fill="hsl(${hue},45%,55%)"/>`,
    `<ellipse cx="300" cy="250" rx="170" ry="110" fill="hsl(${hue},45%,55%)"/>`,
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
<rect width="600" height="600" fill="hsl(${hue},55%,86%)"/>
${shapes[index % shapes.length]}
<text x="300" y="470" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="bold" text-anchor="middle" fill="#1f2937">${escapeXml(product.name)}</text>
<text x="300" y="520" font-family="Arial, Helvetica, sans-serif" font-size="24" text-anchor="middle" fill="#374151">View ${index + 1}</text>
</svg>`;
}

export function buildPdf(lines) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7E]/g, '?');
  let y = 800;
  let content = 'BT\n';
  for (const line of lines) {
    const size = line.size || 11;
    y -= line.gap ?? size + 7;
    content += `/F${line.bold ? 2 : 1} ${size} Tf\n1 0 0 1 ${line.x || 50} ${y} Tm\n(${esc(line.text)}) Tj\n`;
  }
  content += 'ET';

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

export function invoicePdf(order) {
  const money = (n) => `$${n.toFixed(2)}`;
  const lines = [
    { text: 'ShopLab', size: 22, bold: true, gap: 0 },
    { text: `Invoice ${order.number}`, size: 16, bold: true, gap: 34 },
    { text: `Date: ${order.createdAt.slice(0, 10)}`, gap: 24 },
    { text: `Status: ${order.status}` },
    { text: `Bill to: ${order.address.fullName}`, gap: 26 },
    { text: `${order.address.street}, ${order.address.city} ${order.address.postalCode}, ${order.address.country}` },
    { text: 'Items', size: 13, bold: true, gap: 32 },
    ...order.items.map((it) => ({
      text: `${it.qty} x ${it.name}${it.size ? ` (size ${it.size})` : ''}${it.color ? ` (${it.color})` : ''}  -  ${money(it.price * it.qty)}`,
    })),
    { text: `Subtotal: ${money(order.subtotal)}`, gap: 30 },
    { text: `Discount: -${money(order.discount)}${order.coupon ? ` (${order.coupon})` : ''}` },
    { text: `Shipping: ${money(order.shipping)}` },
    { text: `Total: ${money(order.total)}`, size: 14, bold: true, gap: 24 },
    { text: `Paid with ${order.payment.brand} ending in ${order.payment.last4}`, gap: 30 },
    { text: 'Thank you for shopping with ShopLab!', gap: 40 },
  ];
  return buildPdf(lines);
}

export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}
