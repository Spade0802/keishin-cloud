/**
 * 技術職員数値の抽出テスト
 * 実際のPDFを使って新しい6パス目の結果を確認する
 */
import fs from 'fs';
import { VertexAI } from '@google-cloud/vertexai';
import { PDFDocument } from 'pdf-lib';

const buf = fs.readFileSync('C:/Users/user/Downloads/④第58期経営審査提出書類.pdf');

const vertexAI = new VertexAI({ project: 'jww-dxf-converter', location: 'asia-northeast1' });
const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { temperature: 0, responseMimeType: 'application/json' },
});

// Step 1: ページ分割して別紙二ページを特定
const srcDoc = await PDFDocument.load(buf);
const pageCount = srcDoc.getPageCount();
console.log(`PDF: ${pageCount} pages`);

// Step 2: 各ページが別紙二かチェック
const PAGE_DETECT = `このPDFページは「技術職員名簿」（別紙二）ですか？
技術職員名簿は、氏名・生年月日・有資格区分・業種コードなどが表形式で並んでいる名簿です。
回答は "yes" か "no" の1単語だけ返してください。`;

const pages = [];
for (let i = 0; i < pageCount; i++) {
  const doc = await PDFDocument.create();
  const [page] = await doc.copyPages(srcDoc, [i]);
  doc.addPage(page);
  pages.push(Buffer.from(await doc.save()));
}

console.log('\n=== Page Detection ===');
const detections = await Promise.all(
  pages.map(async (pageBuf, idx) => {
    const res = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: pageBuf.toString('base64') } },
          { text: PAGE_DETECT },
        ],
      }],
    });
    const text = res.response.candidates[0].content.parts[0].text?.toLowerCase() ?? '';
    const isStaff = text.includes('yes');
    console.log(`  Page ${idx + 1}: ${isStaff ? '✅ 別紙二' : '❌'} (${text.trim()})`);
    return { idx, isStaff, buf: pageBuf };
  })
);

const staffPages = detections.filter(d => d.isStaff);
console.log(`\nDetected ${staffPages.length} 別紙二 pages: ${staffPages.map(p => p.idx + 1).join(', ')}`);

// Step 3: 別紙二ページだけで技術職員数値を抽出
const PROMPT = `あなたは日本の建設業の経営事項審査（経審）の技術職員名簿を読み取る専門家です。

このPDFの中から技術職員名簿（別紙二）を読み取ってください。

## 技術職員数値の計算ルール
| 区分 | 点数 | 条件 |
|------|------|------|
| 1級+監理 | 6点 | 1級施工管理技士等で、監理技術者講習受講済み＋監理技術者資格者証あり |
| 1級 | 5点 | 1級施工管理技士、技術士等 |
| 基幹技能者 | 3点 | 登録基幹技能者 |
| 2級 | 2点 | 2級施工管理技士、第一種電気工事士等 |
| その他 | 1点 | 第二種電気工事士、実務経験者等 |

## 業種の決定方法（最重要）
業種は資格名から自動的に決まります:
- 「電気工事施工管理技士」「第一種/第二種電気工事士」→ 08(電気)
- 「管工事施工管理技士」→ 09(管)
- 「電気通信工事施工管理技士」→ 22(電気通信)
- 「消防施設工事施工管理技士」→ 27(消防施設)
- 監理技術者資格者証は資格ではなく、1級の追加要素（1級→6点になる）

## ルール
- 1人は最大2業種に計上可
- 同一人物・同一業種で複数資格がある場合、最高点のみ計上
- 各業種の技術職員の点数を合計 = industryTotals
- 表に「業種1」「業種2」列がある場合は両方の業種に計上

{
  "staffList": [
    { "name": "氏名", "industryCode1": "08", "grade1": "1級", "points1": 5, "industryCode2": "", "grade2": "", "points2": 0, "hasSupervisorCert": false, "hasLecture": false }
  ],
  "industryTotals": { "08": 0 },
  "totalStaffCount": 0
}`;

// 別紙二ページだけのPDFを作成
let pdfPart;
if (staffPages.length > 0) {
  const staffDoc = await PDFDocument.create();
  const copiedPages = await staffDoc.copyPages(srcDoc, staffPages.map(p => p.idx));
  for (const page of copiedPages) staffDoc.addPage(page);
  const staffBuf = Buffer.from(await staffDoc.save());
  pdfPart = { inlineData: { mimeType: 'application/pdf', data: staffBuf.toString('base64') } };
  console.log(`\nUsing ${staffPages.length} 別紙二 pages (${(staffBuf.length/1024).toFixed(0)}KB)`);
} else {
  pdfPart = { inlineData: { mimeType: 'application/pdf', data: buf.toString('base64') } };
  console.log('\nUsing full PDF (no 別紙二 page detected)');
}

const result = await model.generateContent({
  contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT }] }],
});

const text = result.response.candidates[0].content.parts[0].text;
const parsed = JSON.parse(text);

console.log('\n=== Tech Staff Extraction Result ===');
console.log(`Total staff count: ${parsed.totalStaffCount}`);
console.log(`\nIndustry totals:`);
for (const [code, val] of Object.entries(parsed.industryTotals || {})) {
  const names = { '08': '電気', '09': '管', '22': '電気通信', '27': '消防施設' };
  console.log(`  ${code} (${names[code] || '?'}): ${val}点`);
}

console.log(`\nStaff list (${parsed.staffList?.length} entries):`);
for (const s of parsed.staffList || []) {
  const ind1 = s.industryCode1 ? `${s.industryCode1}:${s.grade1}=${s.points1}pt` : '';
  const ind2 = s.industryCode2 ? ` ${s.industryCode2}:${s.grade2}=${s.points2}pt` : '';
  const cert = s.hasSupervisorCert ? ' [監理]' : '';
  const lec = s.hasLecture ? ' [講習]' : '';
  console.log(`  ${s.name}${cert}${lec} → ${ind1}${ind2}`);
}
