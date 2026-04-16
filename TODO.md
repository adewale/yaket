# TODO

Deferred items tracked here intentionally remain outside the current implementation tranche.

## Deferred

1. Run Yaket through Bobbin's real `extractTopics` and topic-quality test suite in the Bobbin repository.
2. Expand multilingual support and multilingual parity validation beyond the current smoke and regression coverage.
3. Tighten `seqm` parity with upstream YAKE's optimized similarity path, especially around threshold behavior, early rejection, and near-tie dedup ordering.
4. Continue reducing tokenizer and sentence-splitting drift from Python YAKE's `segtok`-based behavior, especially for Unicode punctuation, contractions, abbreviations, and multilingual texts.
