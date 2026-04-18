# Komoroske Benchmark

- Source archive ID: `1xRiCqpy3LMAgEsHdX-IA23j6nUISdT5nAJmtKbk9wNA`
- Source archive URL: https://raw.githubusercontent.com/adewale/bobbin/main/data/raw/1xRiCqpy3LMAgEsHdX-IA23j6nUISdT5nAJmtKbk9wNA.html
- Episode date: `2026-04-06` (from raw heading `4/6/26`)
- Corpus episodes used for TF-IDF: 25
- Target episode length: 24390 characters

## Runtime

| System | Duration (ms) | Heap Delta (KB) | Notes |
|---|---:|---:|---|
| Yaket | 45.31 | 9724.50 | ok |
| Bobbin | 72.19 | 0.00 | ok |
| TF-IDF | 647.32 | 23041.91 | ok |
| Python YAKE | 356.27 | 157.13 | ok |

## Top Keywords

### Yaket

| Rank | Keyword | Score |
|---:|---|---:|
| 1 | llms | 0.015475 |
| 2 | human | 0.015598 |
| 3 | things | 0.017475 |
| 4 | loop | 0.022636 |
| 5 | software | 0.022976 |
| 6 | humans | 0.023397 |
| 7 | api | 0.025098 |
| 8 | agent | 0.026647 |
| 9 | agent swarms | 0.029371 |
| 10 | agents | 0.029608 |

### Bobbin Baseline

| Rank | Keyword | Score |
|---:|---|---:|
| 1 | thing llms know | 0.033487 |
| 2 | one thing llms | 0.036923 |
| 3 | human intelligence tokens | 0.042725 |
| 4 | need one dimension | 0.044826 |
| 5 | loop means | 0.059860 |
| 6 | theres now energy | 0.061237 |
| 7 | less given llms | 0.063671 |
| 8 | software gets created | 0.071308 |
| 9 | cognitive labor means | 0.081899 |
| 10 | leading one agent | 0.083544 |

### TF-IDF Baseline

| Rank | Keyword | Score |
|---:|---|---:|
| 1 | llms | 18.000000 |
| 2 | fruit | 15.891952 |
| 3 | human | 15.588311 |
| 4 | software | 15.588311 |
| 5 | loop | 15.171703 |
| 6 | lumber | 14.259797 |
| 7 | things | 14.000000 |
| 8 | api | 13.950417 |
| 9 | surface | 13.873118 |
| 10 | process | 13.471228 |

### Python YAKE

| Rank | Keyword | Score |
|---:|---|---:|
| 1 | llms | 0.015673 |
| 2 | human | 0.015908 |
| 3 | things | 0.017773 |
| 4 | api | 0.021475 |
| 5 | loop | 0.023059 |
| 6 | software | 0.023376 |
| 7 | humans | 0.023862 |
| 8 | ’re | 0.024207 |
| 9 | agent | 0.025981 |
| 10 | agents | 0.028868 |

## Overlap

| Comparison | Top-10 Overlap with Python | Shared Keywords |
|---|---:|---|
| Yaket | 9 | agent, agents, api, human, humans, llms, loop, software, things |
| Bobbin baseline | 0 |  |
| TF-IDF | 6 | api, human, llms, loop, software, things |

## Notes

- Yaket is best judged primarily by closeness to Python YAKE plus downstream Bobbin topic quality.
- The TF-IDF baseline uses the same stopword list and up-to-3-gram candidate generation for a cleaner comparison.
- The Bobbin baseline is derived from the original `src/services/yake.ts` implementation.