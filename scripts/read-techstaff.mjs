import fs from 'fs';
import { VertexAI } from '@google-cloud/vertexai';
import { PDFDocument } from 'pdf-lib';

const buf = fs.readFileSync('C:/Users/user/Downloads/④第58期経営審査提出書類.pdf');

// Split to get just page 6 (index 5)
const srcDoc = await PDFDocument.load(buf);
const page6Doc = await PDFDocument.create();
const [page6] = await page6Doc.copyPages(srcDoc, [5]);
page6Doc.addPage(page6);
const page6Buf = Buffer.from(await page6Doc.save());

console.log(`Original PDF: ${srcDoc.getPageCount()} pages, ${(buf.length/1024).toFixed(0)}KB`);
console.log(`Page 6 only: ${(page6Buf.length/1024).toFixed(0)}KB`);

const vertexAI = new VertexAI({ project: 'jww-dxf-converter', location: 'asia-northeast1' });
const model = vertexAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: { temperature: 0 },
});

const prompt = `この1ページのPDFは「別紙二 技術職員名簿」です。

まずこの表の全体構造を教えてください:
1. ヘッダー行（列名）をすべて左から右へ列挙してください
2. 最初の5人分のデータを、各セルの値を | で区切って表現してください
3. 表全体で何列あるか教えてください

フォーマット自由でかまいません。表の生データをそのまま書き起こしてください。
JSON形式は不要です。テキストで返してください。

★★★ 非常に重要: 表の構造 ★★★

別紙二は1人の技術者につき1行で、1行の中に最大5組の「有資格区分＋業種」ペアが横に並ぶ構造です。

| 氏名 | 生年月日 | [資格1コード | 業種1] | [資格2コード | 業種2] | [資格3コード | 業種3] | ... | 講習 | 監理技術者番号 | CPD |

つまり1人の行の中に、複数の（有資格区分, 業種）のペアがあります。

例えば瀬下大樹さんの行には:
  資格1=127, 業種1=08  (1級電気 → 電気)
  資格2=109, 業種2=09  (1級管 → 管)
  資格3=129, 業種3=27  (監理技術者 → 消防施設)
のように3ペアが横に並んでいるかもしれません。

★ 各行のすべての（資格コード, 業種コード）ペアを漏れなく読み取ってください。
★ 業種コードは2桁(01-29)の範囲のみです: 08=電気, 09=管, 22=電気通信, 27=消防施設

この会社は電気(08), 管(09), 消防施設(27)の3業種で経審を受けています。

各技術職員の全情報をJSONで返してください:

{
  "staff": [
    {
      "name": "氏名",
      "birthDate": "生年月日",
      "qualifications": [
        { "qualCode": "127", "industryCode": "08" },
        { "qualCode": "109", "industryCode": "09" }
      ],
      "lecture": false,
      "supervisorCertNo": "",
      "cpdUnits": 0
    }
  ]
}`;

const result = await model.generateContent({
  contents: [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: 'application/pdf', data: page6Buf.toString('base64') } },
      { text: prompt }
    ]
  }]
});

const text = result.response.candidates[0].content.parts[0].text;
console.log(text);
