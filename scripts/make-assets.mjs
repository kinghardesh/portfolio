// Generates public/og.png (link-preview image) and a placeholder public/resume.pdf.
// Each file is only created when missing, so your own versions are never overwritten.
// Delete public/og.png to regenerate it after changing your name or pitch.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const profile = JSON.parse(readFileSync("src/data/profile.json", "utf8"));
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// Wrap the pitch into lines of ~34 chars for the image.
function wrap(text, width) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if ((line + " " + word).trim().length > width) {
      lines.push(line.trim());
      line = word;
    } else line += " " + word;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 4);
}

if (!existsSync("public/og.png")) {
  const pitch = wrap(profile.pitch, 34)
    .map((l, i) => `<text x="80" y="${270 + i * 64}" class="pitch">${esc(l)}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <style>
      .name { font: 600 34px 'Segoe UI', Arial, sans-serif; fill: #e6edf3; }
      .role { font: 400 26px Consolas, monospace; fill: #8b98a8; }
      .pitch { font: 700 52px 'Segoe UI', Arial, sans-serif; fill: #e6edf3; }
    </style>
    <rect width="1200" height="630" fill="#0b0f14"/>
    <rect x="0" y="0" width="1200" height="8" fill="#3ddc97"/>
    <circle cx="92" cy="128" r="10" fill="#3ddc97"/>
    <text x="118" y="140" class="name">${esc(profile.name)}</text>
    <text x="80" y="196" class="role">${esc(profile.role)}</text>
    ${pitch}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile("public/og.png");
  console.log("created public/og.png");
}

if (!existsSync("public/resume.pdf")) {
  // A one-page placeholder PDF, written by hand so no PDF library is needed.
  const lines = [
    [`${profile.name} - Resume`, 24],
    ["PLACEHOLDER: replace public/resume.pdf with your real resume.", 12],
  ];
  const text = lines
    .map(([t, size], i) => `BT /F1 ${size} Tf 72 ${720 - i * 36} Td (${t.replace(/[()\\]/g, "\\$&")}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((obj, i) => {
    const at = Buffer.byteLength(pdf);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  writeFileSync("public/resume.pdf", pdf);
  console.log("created public/resume.pdf (placeholder)");
}
