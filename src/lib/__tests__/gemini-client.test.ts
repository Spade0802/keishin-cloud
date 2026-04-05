import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — vi.hoisted() ensures these are available when vi.mock()
// factories run (vi.mock is hoisted above all other code).
// ---------------------------------------------------------------------------

const {
  mockGetAIConfig,
  mockGetGenerativeModel_paid,
  mockGetGenerativeModel_vertex,
  MockGoogleGenerativeAI,
  MockVertexAI,
} = vi.hoisted(() => {
  const mockGetAIConfig = vi.fn();
  const mockGetGenerativeModel_paid = vi.fn();
  const mockGetGenerativeModel_vertex = vi.fn();

  // Must use `function` (not arrow) so they work with `new`
  const MockGoogleGenerativeAI = vi.fn(function (this: any) {
    this.getGenerativeModel = mockGetGenerativeModel_paid;
  });
  const MockVertexAI = vi.fn(function (this: any) {
    this.getGenerativeModel = mockGetGenerativeModel_vertex;
  });

  return {
    mockGetAIConfig,
    mockGetGenerativeModel_paid,
    mockGetGenerativeModel_vertex,
    MockGoogleGenerativeAI,
    MockVertexAI,
  };
});

vi.mock('../settings', () => ({
  getAIConfig: (...args: unknown[]) => mockGetAIConfig(...args),
}));
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: MockGoogleGenerativeAI,
}));
vi.mock('@google-cloud/vertexai', () => ({
  VertexAI: MockVertexAI,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  isRateLimitError,
  getGeminiModel,
  _resetModelCache,
} from '../gemini-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeModel(tag: string) {
  return {
    _tag: tag,
    generateContent: vi.fn().mockResolvedValue({
      response: { text: () => `response-from-${tag}` },
    }),
  };
}

// ---------------------------------------------------------------------------
// Tests – isRateLimitError
// ---------------------------------------------------------------------------

describe('isRateLimitError', () => {
  it('returns true for Error with 429 status', () => {
    expect(isRateLimitError(new Error('Request failed with status 429'))).toBe(true);
  });

  it('returns true for Error with RESOURCE_EXHAUSTED / quota message', () => {
    expect(isRateLimitError(new Error('RESOURCE_EXHAUSTED: quota exceeded'))).toBe(true);
  });

  it('returns true for "Too Many Requests" message', () => {
    expect(isRateLimitError(new Error('Too Many Requests'))).toBe(true);
  });

  it('returns false for a generic server error', () => {
    expect(isRateLimitError(new Error('Internal Server Error'))).toBe(false);
  });

  it('returns false for a network error', () => {
    expect(isRateLimitError(new Error('ECONNREFUSED'))).toBe(false);
  });

  it('handles non-Error values (string)', () => {
    expect(isRateLimitError('429 rate limited')).toBe(true);
    expect(isRateLimitError('some other string')).toBe(false);
  });

  it('handles non-Error values (number, null, undefined)', () => {
    expect(isRateLimitError(429)).toBe(true);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });

  // ── Edge cases ──

  it('returns true when "429" appears anywhere in the message', () => {
    expect(isRateLimitError(new Error('upstream returned 429 please retry'))).toBe(true);
  });

  it('is case-sensitive: lowercase "quota" matches, uppercase "Quota" does not', () => {
    expect(isRateLimitError(new Error('quota exceeded'))).toBe(true);
    expect(isRateLimitError(new Error('Quota limit reached'))).toBe(false);
  });

  it('returns false for empty string and empty Error', () => {
    expect(isRateLimitError('')).toBe(false);
    expect(isRateLimitError(new Error(''))).toBe(false);
  });

  it('returns false for plain objects (no Error prototype)', () => {
    expect(isRateLimitError({ code: 429 })).toBe(false);
    expect(isRateLimitError({})).toBe(false);
  });

  it('returns false for boolean values', () => {
    expect(isRateLimitError(true)).toBe(false);
    expect(isRateLimitError(false)).toBe(false);
  });

  it('handles Error subclass', () => {
    class ApiError extends Error {
      statusCode: number;
      constructor(msg: string, code: number) {
        super(msg);
        this.statusCode = code;
      }
    }
    expect(isRateLimitError(new ApiError('Too Many Requests', 429))).toBe(true);
    expect(isRateLimitError(new ApiError('Server Error', 500))).toBe(false);
  });

  it('handles symbol (converts via String())', () => {
    // String(Symbol('429')) === "Symbol(429)" which contains "429"
    expect(isRateLimitError(Symbol('429'))).toBe(true);
    expect(isRateLimitError(Symbol('ok'))).toBe(false);
  });

  it('handles combined rate-limit indicators in one message', () => {
    expect(
      isRateLimitError(new Error('429 Too Many Requests: quota exceeded')),
    ).toBe(true);
  });

  it('returns false for HTTP 420 (close but not rate limit)', () => {
    expect(isRateLimitError(new Error('420 Enhance Your Calm'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests – getGeminiModel provider selection
// ---------------------------------------------------------------------------

describe('getGeminiModel – provider selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetModelCache();
    // Restore default constructor implementations after clearAllMocks
    MockGoogleGenerativeAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_paid;
    });
    MockVertexAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_vertex;
    });
  });

  it('returns gemini-paid provider when config has gemini-paid + apiKey', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'test-key-123',
      model: 'gemini-2.5-flash',
    });
    const paidModel = fakeModel('paid');
    mockGetGenerativeModel_paid.mockReturnValue(paidModel);

    const result = await getGeminiModel();

    expect(result.provider).toBe('gemini-paid');
    expect(result.modelName).toBe('gemini-2.5-flash');
    expect(result.model).toBe(paidModel);
    expect(MockGoogleGenerativeAI).toHaveBeenCalledWith('test-key-123');
  });

  it('returns vertex provider when config has gemini (free)', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    const vertexModel = fakeModel('vertex');
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    const result = await getGeminiModel();

    expect(result.provider).toBe('vertex');
    expect(result.model).toBe(vertexModel);
    expect(MockVertexAI).toHaveBeenCalled();
  });

  it('falls back to vertex when gemini-paid has no apiKey', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: undefined,
      model: 'gemini-2.5-flash',
    });
    const vertexModel = fakeModel('vertex');
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    const result = await getGeminiModel();

    expect(result.provider).toBe('vertex');
    expect(result.model).toBe(vertexModel);
  });

  it('falls back to vertex when gemini-paid has empty string apiKey', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: '',
      model: 'gemini-2.5-flash',
    });
    const vertexModel = fakeModel('vertex');
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    const result = await getGeminiModel();

    expect(result.provider).toBe('vertex');
  });
});

// ---------------------------------------------------------------------------
// Tests – model name resolution
// ---------------------------------------------------------------------------

describe('getGeminiModel – model name resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetModelCache();
    MockGoogleGenerativeAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_paid;
    });
    MockVertexAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_vertex;
    });
  });

  it('uses configured gemini model name', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-1.5-pro',
    });
    const vertexModel = fakeModel('vertex');
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    const result = await getGeminiModel();

    expect(result.modelName).toBe('gemini-1.5-pro');
    expect(mockGetGenerativeModel_vertex).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gemini-1.5-pro' }),
    );
  });

  it('falls back to DEFAULT_MODEL when model does not start with "gemini"', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gpt-4o',
    });
    mockGetGenerativeModel_vertex.mockReturnValue(fakeModel('vertex'));

    const result = await getGeminiModel();

    expect(result.modelName).toBe('gemini-2.5-flash');
  });

  it('falls back to DEFAULT_MODEL when model is empty string', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: '',
    });
    mockGetGenerativeModel_vertex.mockReturnValue(fakeModel('vertex'));

    const result = await getGeminiModel();

    expect(result.modelName).toBe('gemini-2.5-flash');
  });

  it('falls back to DEFAULT_MODEL when model is undefined', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: undefined,
    });
    mockGetGenerativeModel_vertex.mockReturnValue(fakeModel('vertex'));

    const result = await getGeminiModel();

    expect(result.modelName).toBe('gemini-2.5-flash');
  });

  it('falls back to DEFAULT_MODEL when model is null', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: null,
    });
    mockGetGenerativeModel_vertex.mockReturnValue(fakeModel('vertex'));

    const result = await getGeminiModel();

    expect(result.modelName).toBe('gemini-2.5-flash');
  });
});

// ---------------------------------------------------------------------------
// Tests – cache behavior
// ---------------------------------------------------------------------------

describe('getGeminiModel – cache behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetModelCache();
    MockGoogleGenerativeAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_paid;
    });
    MockVertexAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_vertex;
    });
  });

  it('caches gemini-paid model and reuses on second call', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    const paidModel = fakeModel('paid');
    mockGetGenerativeModel_paid.mockReturnValue(paidModel);

    const result1 = await getGeminiModel();
    const result2 = await getGeminiModel();

    expect(result1.model).toBe(result2.model);
    expect(MockGoogleGenerativeAI).toHaveBeenCalledTimes(1);
    expect(mockGetGenerativeModel_paid).toHaveBeenCalledTimes(1);
  });

  it('caches vertex model and reuses on second call', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    const vertexModel = fakeModel('vertex');
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    const result1 = await getGeminiModel();
    const result2 = await getGeminiModel();

    expect(result1.model).toBe(result2.model);
    expect(MockVertexAI).toHaveBeenCalledTimes(1);
    expect(mockGetGenerativeModel_vertex).toHaveBeenCalledTimes(1);
  });

  it('invalidates gemini-paid cache when apiKey changes', async () => {
    const paidModel1 = fakeModel('paid-1');
    const paidModel2 = fakeModel('paid-2');
    mockGetGenerativeModel_paid
      .mockReturnValueOnce(paidModel1)
      .mockReturnValueOnce(paidModel2);

    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });

    const result1 = await getGeminiModel();
    expect(result1.model).toBe(paidModel1);

    // Change API key — cache should be invalidated
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-2',
      model: 'gemini-2.5-flash',
    });

    const result2 = await getGeminiModel();
    expect(result2.model).toBe(paidModel2);
    expect(MockGoogleGenerativeAI).toHaveBeenCalledTimes(2);
  });

  it('invalidates gemini-paid cache when model name changes', async () => {
    const paidModel1 = fakeModel('paid-flash');
    const paidModel2 = fakeModel('paid-pro');
    mockGetGenerativeModel_paid
      .mockReturnValueOnce(paidModel1)
      .mockReturnValueOnce(paidModel2);

    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    const result1 = await getGeminiModel();
    expect(result1.model).toBe(paidModel1);

    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-1.5-pro',
    });
    const result2 = await getGeminiModel();
    expect(result2.model).toBe(paidModel2);
  });

  it('invalidates vertex cache when model name changes', async () => {
    const vertexModel1 = fakeModel('vertex-flash');
    const vertexModel2 = fakeModel('vertex-pro');
    mockGetGenerativeModel_vertex
      .mockReturnValueOnce(vertexModel1)
      .mockReturnValueOnce(vertexModel2);

    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    const result1 = await getGeminiModel();
    expect(result1.model).toBe(vertexModel1);

    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-1.5-pro',
    });
    const result2 = await getGeminiModel();
    expect(result2.model).toBe(vertexModel2);
  });

  it('maintains separate caches for paid and vertex providers', async () => {
    const paidModel = fakeModel('paid');
    const vertexModel = fakeModel('vertex');
    mockGetGenerativeModel_paid.mockReturnValue(paidModel);
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    // Call 1: gemini-paid
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    const r1 = await getGeminiModel();
    expect(r1.provider).toBe('gemini-paid');
    expect(r1.model).toBe(paidModel);

    // Call 2: vertex
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    const r2 = await getGeminiModel();
    expect(r2.provider).toBe('vertex');
    expect(r2.model).toBe(vertexModel);

    // Call 3: back to gemini-paid (should reuse cached paid model)
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    const r3 = await getGeminiModel();
    expect(r3.model).toBe(paidModel);
    expect(MockGoogleGenerativeAI).toHaveBeenCalledTimes(1);
  });

  it('_resetModelCache clears both caches forcing re-creation', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    const model1 = fakeModel('first');
    const model2 = fakeModel('second');
    mockGetGenerativeModel_paid
      .mockReturnValueOnce(model1)
      .mockReturnValueOnce(model2);

    const r1 = await getGeminiModel();
    expect(r1.model).toBe(model1);

    _resetModelCache();

    const r2 = await getGeminiModel();
    expect(r2.model).toBe(model2);
    expect(MockGoogleGenerativeAI).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// Tests – getVertexModel fallback
// ---------------------------------------------------------------------------

describe('getGeminiModel – getVertexModel fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetModelCache();
    MockGoogleGenerativeAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_paid;
    });
    MockVertexAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_vertex;
    });
  });

  it('lazily creates a vertex model when called from gemini-paid result', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    const paidModel = fakeModel('paid');
    const vertexModel = fakeModel('vertex-fallback');
    mockGetGenerativeModel_paid.mockReturnValue(paidModel);
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    const result = await getGeminiModel();

    expect(result.provider).toBe('gemini-paid');
    // VertexAI should not be instantiated yet
    expect(MockVertexAI).not.toHaveBeenCalled();

    const fallback = result.getVertexModel();
    expect(fallback).toBe(vertexModel);
    expect(MockVertexAI).toHaveBeenCalledTimes(1);
  });

  it('returns the same model when provider is already vertex', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    const vertexModel = fakeModel('vertex');
    mockGetGenerativeModel_vertex.mockReturnValue(vertexModel);

    const result = await getGeminiModel();

    expect(result.provider).toBe('vertex');
    expect(result.getVertexModel()).toBe(result.model);
  });

  it('repeated getVertexModel calls reuse the cached vertex instance', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    mockGetGenerativeModel_paid.mockReturnValue(fakeModel('paid'));
    mockGetGenerativeModel_vertex.mockReturnValue(fakeModel('vertex'));

    const result = await getGeminiModel();
    const fb1 = result.getVertexModel();
    const fb2 = result.getVertexModel();

    expect(fb1).toBe(fb2);
    expect(MockVertexAI).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Tests – error handling
// ---------------------------------------------------------------------------

describe('getGeminiModel – error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetModelCache();
    // Restore defaults — individual tests override as needed
    MockGoogleGenerativeAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_paid;
    });
    MockVertexAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_vertex;
    });
  });

  it('propagates error when getAIConfig rejects', async () => {
    mockGetAIConfig.mockRejectedValue(new Error('DB connection failed'));

    await expect(getGeminiModel()).rejects.toThrow('DB connection failed');
  });

  it('propagates error when getGenerativeModel (paid) throws', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'bad-key',
      model: 'gemini-2.5-flash',
    });
    mockGetGenerativeModel_paid.mockImplementation(() => {
      throw new Error('Invalid API key format');
    });

    await expect(getGeminiModel()).rejects.toThrow('Invalid API key format');
  });

  it('propagates error when getGenerativeModel (vertex) throws', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    mockGetGenerativeModel_vertex.mockImplementation(() => {
      throw new Error('Model not found');
    });

    await expect(getGeminiModel()).rejects.toThrow('Model not found');
  });

  it('propagates error when GoogleGenerativeAI constructor throws', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'bad-key',
      model: 'gemini-2.5-flash',
    });
    MockGoogleGenerativeAI.mockImplementation(function () {
      throw new Error('SDK init failed');
    });

    await expect(getGeminiModel()).rejects.toThrow('SDK init failed');
  });

  it('propagates error when VertexAI constructor throws', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    MockVertexAI.mockImplementation(function () {
      throw new Error('Missing credentials');
    });

    await expect(getGeminiModel()).rejects.toThrow('Missing credentials');
  });
});

// ---------------------------------------------------------------------------
// Tests – generation config passed to SDK
// ---------------------------------------------------------------------------

describe('getGeminiModel – generation config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetModelCache();
    MockGoogleGenerativeAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_paid;
    });
    MockVertexAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_vertex;
    });
  });

  it('passes correct generationConfig to gemini-paid model', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini-paid',
      apiKey: 'key-1',
      model: 'gemini-2.5-flash',
    });
    mockGetGenerativeModel_paid.mockReturnValue(fakeModel('paid'));

    await getGeminiModel();

    expect(mockGetGenerativeModel_paid).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 65536,
      },
    });
  });

  it('passes correct generationConfig to vertex model', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    mockGetGenerativeModel_vertex.mockReturnValue(fakeModel('vertex'));

    await getGeminiModel();

    expect(mockGetGenerativeModel_vertex).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 65536,
        responseMimeType: 'application/json',
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Tests – module exports
// ---------------------------------------------------------------------------

describe('Module exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetModelCache();
    MockGoogleGenerativeAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_paid;
    });
    MockVertexAI.mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel_vertex;
    });
  });

  it('exports getGeminiModel and isRateLimitError as functions', () => {
    expect(typeof getGeminiModel).toBe('function');
    expect(typeof isRateLimitError).toBe('function');
  });

  it('exports _resetModelCache for testing', () => {
    expect(typeof _resetModelCache).toBe('function');
  });

  it('GeminiModelResult has expected shape', async () => {
    mockGetAIConfig.mockResolvedValue({
      provider: 'gemini',
      model: 'gemini-2.5-flash',
    });
    mockGetGenerativeModel_vertex.mockReturnValue(fakeModel('vertex'));

    const result = await getGeminiModel();

    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('modelName');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('getVertexModel');
    expect(typeof result.getVertexModel).toBe('function');
    expect(typeof result.model.generateContent).toBe('function');
  });
});
