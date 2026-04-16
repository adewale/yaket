import { KeywordExtractor, type KeywordExtractorOptions } from "./KeywordExtractor.js";
import type { KeywordResult } from "./strategies.js";

export interface InputDocument<TMetadata = Record<string, unknown>> {
  id: string;
  body: string;
  language?: string;
  title?: string;
  metadata?: TMetadata;
}

export interface DocumentKeywordResult<TMetadata = Record<string, unknown>> {
  id: string;
  language: string;
  title?: string;
  metadata?: TMetadata;
  keywords: KeywordResult[];
}

export interface DocumentExtractionOptions extends KeywordExtractorOptions {
  includeTitleInText?: boolean;
}

export function extractFromDocument<TMetadata = Record<string, unknown>>(
  document: InputDocument<TMetadata>,
  options: DocumentExtractionOptions = {},
): DocumentKeywordResult<TMetadata> {
  const extractor = new KeywordExtractor({
    ...options,
    lan: options.lan ?? options.language ?? document.language ?? "en",
  });
  const text = buildDocumentText(document, options.includeTitleInText ?? true);

  return {
    id: document.id,
    language: extractor.config.lan,
    title: document.title,
    metadata: document.metadata,
    keywords: extractor.extractKeywordDetails(text),
  };
}

export function extractFromDocuments<TMetadata = Record<string, unknown>>(
  documents: Iterable<InputDocument<TMetadata>>,
  options: DocumentExtractionOptions = {},
): Array<DocumentKeywordResult<TMetadata>> {
  return [...documents].map((document) => extractFromDocument(document, options));
}

export async function* extractFromDocumentStream<TMetadata = Record<string, unknown>>(
  documents: AsyncIterable<InputDocument<TMetadata>>,
  options: DocumentExtractionOptions = {},
): AsyncGenerator<DocumentKeywordResult<TMetadata>> {
  for await (const document of documents) {
    yield extractFromDocument(document, options);
  }
}

function buildDocumentText<TMetadata>(document: InputDocument<TMetadata>, includeTitleInText: boolean): string {
  if (!includeTitleInText || !document.title?.trim()) {
    return document.body;
  }

  return `${document.title.trim()}\n\n${document.body}`;
}
