# TODO

Deferred items tracked here intentionally remain outside the current implementation tranche.

## Deferred

1. Expand multilingual support and multilingual parity validation beyond the current smoke and regression coverage.
2. Tighten `seqm` parity with upstream YAKE's optimized similarity path, especially around threshold behavior, early rejection, and harder edge-case dedup decisions.
3. Continue reducing tokenizer and sentence-splitting drift from Python YAKE's `segtok`-based behavior, especially for multilingual texts and harder Unicode punctuation cases.
4. Extend differential fuzzing beyond the current Unicode, emoji, CJK, and long-document property coverage.
5. Expand multilingual verification and benchmark coverage beyond the current regression suite, especially across the bundled stopword languages.
6. Investigate the remaining Portuguese ranking drift seen in upstream `test_n3_PT`, where Yaket still surfaces `plataforma` and reorders lower-ranked named phrases versus Python YAKE.
