import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock pdf-lib
// ---------------------------------------------------------------------------

const mockSave = vi.fn();
const mockAddPage = vi.fn();
const mockCopyPages = vi.fn();
const mockGetPageCount = vi.fn();
const mockLoad = vi.fn();
const mockCreate = vi.fn();

vi.mock('pdf-lib', () => ({
  PDFDocument: {
    load: (...args: unknown[]) => mockLoad(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake source document with the given page count. */
function buildSrcDoc(pageCount: number) {
  return {
    getPageCount: () => pageCount,
    // copyPages is called on the *destination* doc, but srcDoc is passed as arg
  };
}

/** Build a fake destination document returned by PDFDocument.create(). */
function buildNewDoc(savedBytes: Uint8Array = new Uint8Array([1, 2, 3])) {
  const doc = {
    copyPages: mockCopyPages,
    addPage: mockAddPage,
    save: mockSave.mockResolvedValue(savedBytes),
  };
  return doc;
}

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import {
  splitPdfPages,
  getPdfPageCount,
  extractPdfPageRange,
} from '@/lib/pdf-page-splitter';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('splitPdfPages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('splits a 3-page PDF into 3 individual buffers', async () => {
    const srcDoc = buildSrcDoc(3);
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc(new Uint8Array([10, 20]));
    mockCreate.mockResolvedValue(newDoc);

    const fakePage = { type: 'page' };
    mockCopyPages.mockResolvedValue([fakePage]);

    const input = Buffer.from('fake-pdf');
    const result = await splitPdfPages(input);

    expect(mockLoad).toHaveBeenCalledWith(input);
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(mockCopyPages).toHaveBeenCalledTimes(3);
    // Each call copies a single page index
    expect(mockCopyPages).toHaveBeenNthCalledWith(1, srcDoc, [0]);
    expect(mockCopyPages).toHaveBeenNthCalledWith(2, srcDoc, [1]);
    expect(mockCopyPages).toHaveBeenNthCalledWith(3, srcDoc, [2]);
    expect(mockAddPage).toHaveBeenCalledTimes(3);
    expect(mockSave).toHaveBeenCalledTimes(3);

    expect(result).toHaveLength(3);
    result.forEach((buf) => {
      expect(Buffer.isBuffer(buf)).toBe(true);
    });
  });

  it('returns a single buffer for a 1-page PDF', async () => {
    const srcDoc = buildSrcDoc(1);
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc(new Uint8Array([99]));
    mockCreate.mockResolvedValue(newDoc);
    mockCopyPages.mockResolvedValue([{ type: 'page' }]);

    const result = await splitPdfPages(Buffer.from('single-page'));

    expect(result).toHaveLength(1);
    expect(mockCopyPages).toHaveBeenCalledWith(srcDoc, [0]);
  });

  it('returns an empty array for a 0-page PDF', async () => {
    const srcDoc = buildSrcDoc(0);
    mockLoad.mockResolvedValue(srcDoc);

    const result = await splitPdfPages(Buffer.from('empty'));

    expect(result).toEqual([]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('handles a large number of pages (100)', async () => {
    const pageCount = 100;
    const srcDoc = buildSrcDoc(pageCount);
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc();
    mockCreate.mockResolvedValue(newDoc);
    mockCopyPages.mockResolvedValue([{ type: 'page' }]);

    const result = await splitPdfPages(Buffer.from('big-pdf'));

    expect(result).toHaveLength(pageCount);
    expect(mockCreate).toHaveBeenCalledTimes(pageCount);
  });

  it('propagates error when PDFDocument.load fails', async () => {
    mockLoad.mockRejectedValue(new Error('corrupt PDF'));

    await expect(splitPdfPages(Buffer.from('bad'))).rejects.toThrow(
      'corrupt PDF',
    );
  });

  it('propagates error when save fails', async () => {
    const srcDoc = buildSrcDoc(1);
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc();
    mockCreate.mockResolvedValue(newDoc);
    mockCopyPages.mockResolvedValue([{ type: 'page' }]);
    mockSave.mockRejectedValue(new Error('save failed'));

    await expect(splitPdfPages(Buffer.from('data'))).rejects.toThrow(
      'save failed',
    );
  });
});

describe('getPdfPageCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the page count of a PDF', async () => {
    mockLoad.mockResolvedValue(buildSrcDoc(5));

    const count = await getPdfPageCount(Buffer.from('pdf'));

    expect(count).toBe(5);
  });

  it('returns 0 for an empty PDF', async () => {
    mockLoad.mockResolvedValue(buildSrcDoc(0));

    const count = await getPdfPageCount(Buffer.from('empty'));

    expect(count).toBe(0);
  });

  it('propagates load errors', async () => {
    mockLoad.mockRejectedValue(new Error('bad buffer'));

    await expect(getPdfPageCount(Buffer.from('bad'))).rejects.toThrow(
      'bad buffer',
    );
  });
});

describe('extractPdfPageRange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts pages 1-3 from a 5-page PDF', async () => {
    const srcDoc = buildSrcDoc(5);
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc(new Uint8Array([42]));
    mockCreate.mockResolvedValue(newDoc);

    const fakePages = [{ p: 1 }, { p: 2 }, { p: 3 }];
    mockCopyPages.mockResolvedValue(fakePages);

    const result = await extractPdfPageRange(Buffer.from('pdf'), 1, 3);

    expect(mockCopyPages).toHaveBeenCalledWith(srcDoc, [1, 2, 3]);
    expect(mockAddPage).toHaveBeenCalledTimes(3);
    expect(mockAddPage).toHaveBeenNthCalledWith(1, fakePages[0]);
    expect(mockAddPage).toHaveBeenNthCalledWith(2, fakePages[1]);
    expect(mockAddPage).toHaveBeenNthCalledWith(3, fakePages[2]);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('clamps startPage to 0 when negative', async () => {
    const srcDoc = buildSrcDoc(3);
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc();
    mockCreate.mockResolvedValue(newDoc);
    mockCopyPages.mockResolvedValue([{ p: 0 }, { p: 1 }]);

    await extractPdfPageRange(Buffer.from('pdf'), -5, 1);

    // start clamped to 0, end stays 1 → indices [0, 1]
    expect(mockCopyPages).toHaveBeenCalledWith(srcDoc, [0, 1]);
  });

  it('clamps endPage to last page when exceeding page count', async () => {
    const srcDoc = buildSrcDoc(3); // pages 0,1,2
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc();
    mockCreate.mockResolvedValue(newDoc);
    mockCopyPages.mockResolvedValue([{ p: 1 }, { p: 2 }]);

    await extractPdfPageRange(Buffer.from('pdf'), 1, 100);

    // end clamped to 2 → indices [1, 2]
    expect(mockCopyPages).toHaveBeenCalledWith(srcDoc, [1, 2]);
  });

  it('extracts a single page when start === end', async () => {
    const srcDoc = buildSrcDoc(5);
    mockLoad.mockResolvedValue(srcDoc);

    const newDoc = buildNewDoc();
    mockCreate.mockResolvedValue(newDoc);
    mockCopyPages.mockResolvedValue([{ p: 2 }]);

    await extractPdfPageRange(Buffer.from('pdf'), 2, 2);

    expect(mockCopyPages).toHaveBeenCalledWith(srcDoc, [2]);
    expect(mockAddPage).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from load', async () => {
    mockLoad.mockRejectedValue(new Error('load error'));

    await expect(
      extractPdfPageRange(Buffer.from('bad'), 0, 1),
    ).rejects.toThrow('load error');
  });
});
