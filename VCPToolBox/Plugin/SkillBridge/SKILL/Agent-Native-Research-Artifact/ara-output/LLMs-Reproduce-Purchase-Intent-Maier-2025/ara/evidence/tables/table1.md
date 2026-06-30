# Table 1: Metrics for All Purchase Intent Experiments

**Source**: Maier et al. (2025), Table 1.

## Key Rows

| Elicit. | Dem. | Model | Stim. | T_LLM | Best Σ ρ (%) | K_xy | R_xy | E[PI_s] ± std |
|---------|------|-------|-------|-------|--------------|------|------|-------------:|
| Direct | Full | GPT-4o | Image | 0.5 | 81.7 | 0.26 | 0.66 | 2.96 ± 0.11 |
| Direct | Full | Gem-2f | Image | 0.5 | 80.2 | 0.39 | 0.64 | 3.17 ± 0.40 |
| SSR | Full | GPT-4o | Image | 0.5 | 90.2 | 0.88 | 0.72 | 3.77 ± 0.31 |
| SSR | Full | Gem-2f | Image | 0.5 | 90.6 | 0.80 | 0.72 | 3.51 ± 0.42 |
| SSR | None | GPT-4o | Text | 0.5 | 47.4* | 0.91 | 0.41 | 3.92 ± 0.14 |
| SSR | None | Gem-2f | Image | 0.5 | 50.1 | 0.91 | 0.41 | 4.09 ± 0.07 |
| FLR | Full | GPT-4o | Image | 0.5 | 84.7 | 0.72 | 0.69 | 3.67 ± 0.55 |
| FLR | Full | Gem-2f | Image | 0.5 | 92.1 | 0.59 | 0.74 | 3.33 ± 0.75 |

## Notes
- **No-demo SSR (Gem-2f, Image)**: E[PI] = 4.09 ± 0.07 — almost exactly the human mean
- **Stimulus comparison**: Text-only moderately reduces correlation but does not change patterns
- **Relevance generalization** (not shown): SSR ρ = 82%, FLR ρ = 91%

## Cross-References
- T01 → C01, C02, C03
- E01-E03 → C01, C02; E04-E05 → C03; E06 → C04; E09 → C06; E10 → C07