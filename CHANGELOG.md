# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0 - 2026-04-16

Release alignment update for GitHub and npm readiness.

### Changed

- bumped the project version from `0.1.0` to `0.2.0`
- added npm-facing package metadata for repository, homepage, bugs, engines, and publish config
- tightened installation and documentation wording so it matches the current non-npm-published state

### Notes

- GitHub releases and package metadata now align on `0.2.0`
- npm publishing itself remains deferred and is still tracked in `TODO.md`

## 0.1.0 - 2026-04-16

Initial public release.

### Added

- YAKE-compatible TypeScript core extraction pipeline with `KeywordExtractor`, `DataCore`, `SingleWord`, and `ComposedWord`
- bundled stopwords and JS-native tokenization/sentence-splitting utilities
- Bobbin-compatible adapter output and document-oriented pipeline helpers
- optional hooks for text processing, normalization, similarity, scoring, and filtering
- CLI, text highlighting, cache diagnostics, and Cloudflare Worker runtime coverage
- Python parity tests, golden fixtures, property-based tests, benchmark harness, and package validation
- architecture, integration, audit, and benchmark documentation

### Notes

- The current biggest parity risks remain `seqm` similarity behavior and tokenizer drift from Python YAKE's `segtok`-based flow.
- Deferred work is tracked in `TODO.md`.
