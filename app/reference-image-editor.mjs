import sharp from "sharp";
import { createWorker } from "tesseract.js";

let workerPromise;

async function getWorker() {
  workerPromise ??= createWorker("eng");
  return workerPromise;
}

function decodeDataUrl(value) {
  const match = /^data:[^;]+;base64,(.+)$/s.exec(value || "");
  if (!match) throw new Error("Reference image must be a base64 data URL.");
  return Buffer.from(match[1], "base64");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sampleGreen(raw, width, height, box) {
  let green = 0;
  let samples = 0;
  const left = clamp(Math.floor(box.x0 - 12), 0, width - 1);
  const right = clamp(Math.ceil(box.x1 + 12), 0, width - 1);
  const top = clamp(Math.floor(box.y0 - 8), 0, height - 1);
  const bottom = clamp(Math.ceil(box.y1 + 8), 0, height - 1);
  for (let y = top; y <= bottom; y += Math.max(1, Math.floor((bottom - top) / 6))) {
    for (let x = left; x <= right; x += Math.max(1, Math.floor((right - left) / 6))) {
      const i = (y * width + x) * 4;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (g > r * 1.25 && g > b * 1.1) green++;
      samples++;
    }
  }
  return samples > 0 && green / samples > 0.18;
}

function sampleTextColor(raw, width, height, box) {
  let red = 0, green = 0, blue = 0, count = 0;
  const x0 = clamp(Math.floor(box.x0), 0, width - 1);
  const x1 = clamp(Math.ceil(box.x1), 0, width - 1);
  const y0 = clamp(Math.floor(box.y0), 0, height - 1);
  const y1 = clamp(Math.ceil(box.y1), 0, height - 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (r + g + b < 570 && Math.max(r, g, b) - Math.min(r, g, b) < 150) {
        red += r;
        green += g;
        blue += b;
        count++;
      }
    }
  }
  if (!count) return "#17344a";
  return `rgb(${Math.round(red / count)},${Math.round(green / count)},${Math.round(blue / count)})`;
}

function findInkBounds(raw, width, height, box, predicate) {
  const x0 = clamp(Math.floor(box.x0), 0, width - 1);
  const x1 = clamp(Math.ceil(box.x1), 0, width - 1);
  const y0 = clamp(Math.floor(box.y0), 0, height - 1);
  const y1 = clamp(Math.ceil(box.y1), 0, height - 1);
  const columns = [];
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    let rowCount = 0;
    for (let x = x0; x <= x1; x++) {
      const i = (y * width + x) * 4;
      if (predicate(raw[i], raw[i + 1], raw[i + 2])) {
        rowCount++;
        columns.push(x);
      }
    }
    if (rowCount) rows.push(y);
  }
  if (!columns.length || !rows.length) return undefined;
  return {
    x0: Math.min(...columns),
    y0: Math.min(...rows),
    x1: Math.max(...columns) + 1,
    y1: Math.max(...rows) + 1,
  };
}

function darkInk(r, g, b) {
  return r < 145 && g < 165 && b < 180 && (Math.max(r, g, b) - Math.min(r, g, b) > 12);
}

function lightInk(r, g, b) {
  return r > 155 && g > 155 && b > 155 && Math.max(r, g, b) - Math.min(r, g, b) < 55;
}

function detectSurfaceTextRegions(raw, width, height, greenBand) {
  if (!greenBand) return undefined;

  // The band is the stable visual anchor on this packaging. It is not based
  // on user coordinates, and it remains valid when the image is resized.
  const bandWidth = greenBand.x1 - greenBand.x0;
  const edgeInset = Math.max(10, Math.min(38, Math.round(bandWidth * 0.075)));
  const panel = {
    x0: greenBand.x0 + edgeInset,
    x1: greenBand.x1 - Math.max(8, Math.round(edgeInset * 0.3)),
    // Keep the search close to the label band. This avoids shadows, package
    // edges, and the blister tray being interpreted as title text.
    y0: Math.max(0, greenBand.y0 - Math.max(96, Math.round((greenBand.y1 - greenBand.y0) * 1.95))),
    y1: greenBand.y0 - 12,
  };
  const productInk = findInkBounds(raw, width, height, panel, darkInk);
  const product = productInk
    ? { x0: productInk.x0 - 2, y0: productInk.y0 - 3, x1: productInk.x1 + 10, y1: productInk.y1 + 3, lineCount: 2 }
    : { x0: panel.x0, y0: panel.y0, x1: panel.x1, y1: panel.y1, lineCount: 2 };

  const bandTextArea = {
    x0: greenBand.x0 + Math.max(8, Math.round(edgeInset * 0.45)),
    x1: greenBand.x1 - Math.max(8, Math.round(edgeInset * 0.45)),
    y0: greenBand.y0 + 5,
    y1: greenBand.y1 - 5,
  };
  const brandInk = findInkBounds(raw, width, height, bandTextArea, lightInk);
  const brand = brandInk
    ? {
        // Preserve the reference label's left/right padding. The replacement
        // can be longer than the old brand, but it stays inside the same
        // padded surface instead of changing the visual spacing.
        x0: brandInk.x0 - 2,
        y0: brandInk.y0 - 3,
        x1: greenBand.x1 - Math.max(6, greenBand.x1 - brandInk.x1),
        y1: brandInk.y1 + 3,
        lineCount: 1,
      }
    : { x0: bandTextArea.x0, y0: bandTextArea.y0, x1: bandTextArea.x1, y1: bandTextArea.y1, lineCount: 1 };

  return { product, brand };
}

function detectGreenBand(raw, width, height) {
  const rows = [];
  for (let y = 0; y < height; y += 2) {
    let runStart = -1;
    let bestStart = -1;
    let bestEnd = -1;
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      if (g > r * 1.08 && g > b * 1.02 && g > 35) {
        if (runStart < 0) runStart = x;
      } else if (runStart >= 0) {
        if (x - runStart > bestEnd - bestStart) {
          bestStart = runStart;
          bestEnd = x;
        }
        runStart = -1;
      }
    }
    if (runStart >= 0 && width - runStart > bestEnd - bestStart) {
      bestStart = runStart;
      bestEnd = width;
    }
    if (bestEnd - bestStart > width * 0.18) {
      rows.push({ y, minX: bestStart, maxX: bestEnd });
    }
  }
  if (!rows.length) return undefined;
  const groups = [];
  let group = [rows[0]];
  for (let i = 1; i < rows.length; i++) {
    // White brand glyphs interrupt the green run for several rows. Keep those
    // rows in the same band instead of splitting the label into fragments.
    if (rows[i].y - rows[i - 1].y <= 32) group.push(rows[i]);
    else {
      groups.push(group);
      group = [rows[i]];
    }
  }
  groups.push(group);
  const selected = groups
    .map((group) => ({
      group,
      width: Math.max(...group.map((row) => row.maxX - row.minX)),
      height: group[group.length - 1].y - group[0].y + 2,
    }))
    // A packaging label band is long and thin. This rejects green capsules,
    // vertical edge strips, and reflected pixels below the product.
    .filter((candidate) => candidate.width > width * 0.18 && candidate.width / candidate.height > 3)
    .sort((a, b) => b.width - a.width)[0]?.group;
  if (!selected) return undefined;
  const start = selected[0];
  const end = selected[selected.length - 1];
  return { x0: start.minX, x1: end.maxX, y0: start.y, y1: end.y + 2 };
}

function reconstructRegion(raw, width, height, box, isGreen) {
  const x0 = clamp(Math.floor(box.x0 - 1), 0, width - 1);
  const x1 = clamp(Math.ceil(box.x1 + 1), 0, width - 1);
  const y0 = clamp(Math.floor(box.y0 - 1), 0, height - 1);
  const y1 = clamp(Math.ceil(box.y1 + 1), 0, height - 1);
  const copy = Buffer.from(raw);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const index = (y * width + x) * 4;
      let source;
      if (isGreen) {
        const left = (y * width + Math.max(0, x0 - 2)) * 4;
        const right = (y * width + Math.min(width - 1, x1 + 2)) * 4;
        const ratio = (x - x0) / Math.max(1, x1 - x0);
        source = [
          copy[left] + (copy[right] - copy[left]) * ratio,
          copy[left + 1] + (copy[right + 1] - copy[left + 1]) * ratio,
          copy[left + 2] + (copy[right + 2] - copy[left + 2]) * ratio,
        ];
      } else {
        const upper = (Math.max(0, y0 - 3) * width + x) * 4;
        const lower = (Math.min(height - 1, y1 + 3) * width + x) * 4;
        const ratio = (y - y0) / Math.max(1, y1 - y0);
        source = [
          copy[upper] + (copy[lower] - copy[upper]) * ratio,
          copy[upper + 1] + (copy[lower + 1] - copy[upper + 1]) * ratio,
          copy[upper + 2] + (copy[lower + 2] - copy[upper + 2]) * ratio,
        ];
      }
      raw[index] = source[0];
      raw[index + 1] = source[1];
      raw[index + 2] = source[2];
      raw[index + 3] = copy[index + 3];
    }
  }
}

function textOverlay(text, box, color, width, lineCount = 1) {
  const availableWidth = Math.max(20, box.x1 - box.x0);
  const originalLineHeight = Math.max(10, (box.y1 - box.y0) / Math.max(1, lineCount));
  // Start at the reference text scale. Wrapping is preferred; shrinking the
  // entire replacement to one line makes bottle labels look visibly wrong.
  let fontSize = Math.max(10, originalLineHeight * 0.95);
  // Escape XML characters without deleting valid product names such as
  // "Amlodipine & Atenolol".
  const safeText = String(text).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
  const words = safeText.split(/\s+/).filter(Boolean);
  const wrap = (size) => {
    const wrapped = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && next.length * size * 0.58 > availableWidth) {
        wrapped.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) wrapped.push(line);
    return wrapped;
  };
  let lines = wrap(fontSize);
  while (lines.length > lineCount && fontSize > 10) {
    fontSize -= 0.5;
    lines = wrap(fontSize);
  }
  const renderedHeight = Math.max(1, lines.length * fontSize * 1.08);
  const verticalOffset = Math.max(0, ((box.y1 - box.y0) - renderedHeight) / 2);
  const textY = box.y0 + verticalOffset + fontSize;
  const tspans = lines.slice(0, lineCount).map((value, index) =>
    `<tspan x="${box.x0}" dy="${index === 0 ? 0 : fontSize * 1.08}">${value}</tspan>`,
  ).join("");
  return Buffer.from(`<svg width="${width}" height="${Math.max(1, box.y1 + fontSize * 2)}" xmlns="http://www.w3.org/2000/svg"><text x="${box.x0}" y="${textY}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="${color}">${tspans}</text></svg>`);
}

export async function replaceProductAndBrandText(referenceDataUrl, productName, brandName) {
  const input = decodeDataUrl(referenceDataUrl);
  const { data: raw, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const worker = await getWorker();
  const ocr = await worker.recognize(input, {}, { blocks: true });
  const blockLines = (ocr.data.blocks || []).flatMap((block) =>
    (block.paragraphs || []).flatMap((paragraph) => paragraph.lines || []),
  );
  const detectedLines = blockLines.length
    ? blockLines
    : ocr.data.lines?.length
      ? ocr.data.lines
    : Object.values((ocr.data.words || []).reduce((groups, word) => {
        const key = word.line_num ?? Math.round(word.bbox.y0 / 12);
        groups[key] ||= [];
        groups[key].push(word);
        return groups;
      }, {})).map((words) => ({
        text: words.map((word) => word.text).join(" "),
        bbox: {
          x0: Math.min(...words.map((word) => word.bbox.x0)),
          y0: Math.min(...words.map((word) => word.bbox.y0)),
          x1: Math.max(...words.map((word) => word.bbox.x1)),
          y1: Math.max(...words.map((word) => word.bbox.y1)),
        },
      }));
  const lines = detectedLines
    .map((line) => ({ text: line.text?.trim(), box: { x0: line.bbox.x0, y0: line.bbox.y0, x1: line.bbox.x1, y1: line.bbox.y1 } }))
    .filter((line) => line.text && line.box.x1 > line.box.x0 && line.box.y1 > line.box.y0)
    .sort((a, b) => a.box.y0 - b.box.y0);
  if (lines.length < 2) throw new Error("Could not detect both product-name and brand-name text.");

  const greenBand = detectGreenBand(raw, info.width, info.height);
  const surfaceRegions = detectSurfaceTextRegions(raw, info.width, info.height, greenBand);
  if (surfaceRegions) {
    const originalPixels = Buffer.from(raw);
    const productColor = sampleTextColor(originalPixels, info.width, info.height, surfaceRegions.product);
    const productText = String(productName);
    const productLineCount = Math.min(
      4,
      Math.max(surfaceRegions.product.lineCount, Math.ceil(productText.length / 40)),
    );
    reconstructRegion(raw, info.width, info.height, surfaceRegions.product, false);
    reconstructRegion(raw, info.width, info.height, surfaceRegions.brand, true);
    const cleaned = await sharp(raw, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
    const composed = await sharp(cleaned).composite([
      { input: textOverlay(productText, { ...surfaceRegions.product, lineCount: productLineCount }, productColor, info.width, productLineCount), top: 0, left: 0 },
      { input: textOverlay(brandName, surfaceRegions.brand, "#ffffff", info.width, 1), top: 0, left: 0 },
    ]).png().toBuffer();
    return `data:image/png;base64,${composed.toString("base64")}`;
  }

  const brandIndex = greenBand
    ? lines.findIndex((line, index) =>
        index > 0 &&
        line.box.y0 <= greenBand.y1 + 12 &&
        line.box.y1 >= greenBand.y0 - 12,
      )
    : lines.findIndex((line, index) => index > 0 && sampleGreen(raw, info.width, info.height, line.box));
  const selectedBrandIndex = brandIndex >= 0 ? brandIndex : Math.min(1, lines.length - 1);
  const brandLine = lines[selectedBrandIndex];
  const titleLines = lines
    .slice(0, selectedBrandIndex)
    .filter((line) => line.box.y1 <= brandLine.box.y0)
    .slice(-2);
  const productLine = titleLines.length
    ? {
        text: titleLines.map((line) => line.text).join(" "),
        lineCount: titleLines.length,
        box: {
          x0: Math.min(...titleLines.map((line) => line.box.x0)),
          y0: Math.min(...titleLines.map((line) => line.box.y0)),
          x1: Math.max(...titleLines.map((line) => line.box.x1)),
          y1: Math.max(...titleLines.map((line) => line.box.y1)),
        },
      }
    : { ...lines[0], lineCount: 1 };
  const productIsGreen = sampleGreen(raw, info.width, info.height, productLine.box);
  const brandIsGreen = sampleGreen(raw, info.width, info.height, brandLine.box);
  const originalPixels = Buffer.from(raw);
  const productColor = productIsGreen ? "#ffffff" : sampleTextColor(originalPixels, info.width, info.height, productLine.box);
  const brandColor = brandIsGreen ? "#ffffff" : sampleTextColor(originalPixels, info.width, info.height, brandLine.box);
  reconstructRegion(raw, info.width, info.height, productLine.box, productIsGreen);
  reconstructRegion(raw, info.width, info.height, brandLine.box, brandIsGreen);
  const cleaned = await sharp(raw, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  const composed = await sharp(cleaned).composite([
    { input: textOverlay(productName, productLine.box, productColor, info.width, productLine.lineCount), top: 0, left: 0 },
    { input: textOverlay(brandName, brandLine.box, brandColor, info.width, 1), top: 0, left: 0 },
  ]).png().toBuffer();
  return `data:image/png;base64,${composed.toString("base64")}`;
}

export { detectGreenBand, detectSurfaceTextRegions };
