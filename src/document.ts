import { KeywordExtractor, type KeywordExtractorOptions } from "./KeywordExtractor.js";
import type { KeywordResult } from "./strategies.js";

/**
 * Minimal document shape for pipeline-oriented extraction.
 */
export interface InputDocument<TMetadata = Record<string, unknown>> {
  id: string;
  body: string;
  language?: string;
  title?: string;
  metadata?: TMetadata;
}

/**
 * Extraction result paired with the original document identity and metadata.
 */
export interface DocumentKeywordResult<TMetadata = Record<string, unknown>> {
  id: string;
  language: string;
  title?: string;
  metadata?: TMetadata;
  keywords: KeywordResult[];
}

/**
 * Context passed to pre-extraction document text hooks.
 */
export interface DocumentTextHookContext<TMetadata = unknown> {
  document: InputDocument<TMetadata>;
  language: string;
  includeTitleInText: boolean;
}

/**
 * Context passed to post-extraction keyword hooks.
 */
export interface DocumentKeywordHookContext<TMetadata = unknown> {
  document: InputDocument<TMetadata>;
  language: string;
  text: string;
}

/**
 * Extraction options for document helpers.
 */
export interface DocumentExtractionOptions extends KeywordExtractorOptions {
  includeTitleInText?: boolean;
  beforeExtractText?: (text: string, context: DocumentTextHookContext) => string;
  afterExtractKeywords?: (keywords: KeywordResult[], context: DocumentKeywordHookContext) => KeywordResult[];
}

/**
 * Extracts keyword details from a single document.
 */
export function extractFromDocument<TMetadata = Record<string, unknown>>(
  document: InputDocument<TMetadata>,
  options: DocumentExtractionOptions = {},
): DocumentKeywordResult<TMetadata> {
  const language = options.lan ?? options.language ?? document.language ?? "en";
  const extractor = new KeywordExtractor({
    ...options,
    lan: language,
  });
  const text = prepareDocumentText(document, options, language);
  const keywords = finalizeDocumentKeywords(extractor.extractKeywordDetails(text), document, text, options, language);

  return {
    id: document.id,
    language: extractor.config.lan,
    title: document.title,
    metadata: document.metadata,
    keywords,
  };
}

/**
 * Extracts keyword details for an iterable of documents.
 */
export function extractFromDocuments<TMetadata = Record<string, unknown>>(
  documents: Iterable<InputDocument<TMetadata>>,
  options: DocumentExtractionOptions = {},
): Array<DocumentKeywordResult<TMetadata>> {
  const extractorForLanguage = createExtractorCache(options);

  return [...documents].map((document) => {
    const language = document.language ?? options.lan ?? options.language ?? "en";
    const extractor = extractorForLanguage(language);
    const text = prepareDocumentText(document, options, language);
    const keywords = finalizeDocumentKeywords(extractor.extractKeywordDetails(text), document, text, options, language);

    return {
      id: document.id,
      language: extractor.config.lan,
      title: document.title,
      metadata: document.metadata,
      keywords,
    };
  });
}

/**
 * Extracts keyword details for an async stream of documents.
 */
export async function* extractFromDocumentStream<TMetadata = Record<string, unknown>>(
  documents: AsyncIterable<InputDocument<TMetadata>>,
  options: DocumentExtractionOptions = {},
): AsyncGenerator<DocumentKeywordResult<TMetadata>> {
  const extractorForLanguage = createExtractorCache(options);

  for await (const document of documents) {
    const language = document.language ?? options.lan ?? options.language ?? "en";
    const extractor = extractorForLanguage(language);
    const text = prepareDocumentText(document, options, language);
    const keywords = finalizeDocumentKeywords(extractor.extractKeywordDetails(text), document, text, options, language);

    yield {
      id: document.id,
      language: extractor.config.lan,
      title: document.title,
      metadata: document.metadata,
      keywords,
    };
  }
}

/**
 * Stable JSON serialization for a document extraction result.
 */
export function serializeDocumentKeywordResult<TMetadata = Record<string, unknown>>(result: DocumentKeywordResult<TMetadata>): string {
  return stableStringify(result);
}

/**
 * Stable JSON serialization for an ordered collection of document extraction results.
 */
export function serializeDocumentKeywordResults<TMetadata = Record<string, unknown>>(results: Iterable<DocumentKeywordResult<TMetadata>>): string {
  return stableStringify([...results]);
}

/**
 * Estimates the UTF-8 byte size of a stable serialized payload.
 */
export function estimateSerializedBytes(value: unknown): number {
  return new TextEncoder().encode(stableStringify(value)).length;
}

function buildDocumentText<TMetadata>(document: InputDocument<TMetadata>, includeTitleInText: boolean): string {
  if (!includeTitleInText || !document.title?.trim()) {
    return document.body;
  }

  return `${document.title.trim()}\n\n${document.body}`;
}

function prepareDocumentText<TMetadata>(
  document: InputDocument<TMetadata>,
  options: DocumentExtractionOptions,
  language: string,
): string {
  const includeTitleInText = options.includeTitleInText ?? true;
  const text = buildDocumentText(document, includeTitleInText);
  return options.beforeExtractText == null
    ? text
    : options.beforeExtractText(text, { document, language, includeTitleInText });
}

function finalizeDocumentKeywords<TMetadata>(
  keywords: KeywordResult[],
  document: InputDocument<TMetadata>,
  text: string,
  options: DocumentExtractionOptions,
  language: string,
): KeywordResult[] {
  return options.afterExtractKeywords == null
    ? keywords
    : options.afterExtractKeywords(keywords, { document, language, text });
}

function createExtractorCache(options: DocumentExtractionOptions): (language: string) => KeywordExtractor {
  const cache = new Map<string, KeywordExtractor>();

  return (language: string) => {
    const cacheKey = language;
    const existing = cache.get(cacheKey);
    if (existing != null) {
      return existing;
    }

    const extractor = new KeywordExtractor({
      ...options,
      lan: options.lan ?? options.language ?? language,
    });
    cache.set(cacheKey, extractor);
    return extractor;
  };
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }

  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortJsonValue(entryValue)]),
    );
  }

  return value;
}
