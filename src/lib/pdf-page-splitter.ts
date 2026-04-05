/**
 * PDF ページ分割ユーティリティ
 *
 * pdf-lib を使って PDF を個別ページに分割する。
 * 各ページを個別の Gemini インスタンスに送ることで、
 * ページごとの注意力を最大化し、抽出精度を向上させる。
 */

import { PDFDocument } from 'pdf-lib';

/**
 * PDFバッファをページごとのバッファ配列に分割する
 */
export async function splitPdfPages(buffer: Buffer): Promise<Buffer[]> {
  const srcDoc = await PDFDocument.load(buffer);
  const pageCount = srcDoc.getPageCount();

  const pageBuffers: Buffer[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save();
    pageBuffers.push(Buffer.from(pdfBytes));
  }

  return pageBuffers;
}

/**
 * PDFのページ数を取得する
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer);
  return doc.getPageCount();
}

/**
 * 指定ページ範囲のPDFを作成する
 */
export async function extractPdfPageRange(
  buffer: Buffer,
  startPage: number,
  endPage: number,
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(buffer);
  const pageCount = srcDoc.getPageCount();
  const newDoc = await PDFDocument.create();

  const start = Math.max(0, startPage);
  const end = Math.min(pageCount - 1, endPage);

  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const copiedPages = await newDoc.copyPages(srcDoc, indices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const pdfBytes = await newDoc.save();
  return Buffer.from(pdfBytes);
}
