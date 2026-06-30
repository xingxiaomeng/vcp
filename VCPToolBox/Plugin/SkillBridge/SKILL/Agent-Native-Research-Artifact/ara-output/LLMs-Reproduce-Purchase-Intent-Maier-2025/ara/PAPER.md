---
title: "LLMs Reproduce Human Purchase Intent via Semantic Similarity Elicitation of Likert Ratings"
authors:
  - "Benjamin F. Maier"
  - "Ulf Aslak"
  - "Luca Fiaschi"
  - "Nina Rismal"
  - "Kemble Fletcher"
  - "Christian C. Luhmann"
  - "Robbie Dow"
  - "Kli Pappas"
  - "Thomas V. Wiecki"
year: 2025
venue: "arXiv preprint (arXiv:2510.08338v3)"
doi: "arXiv:2510.08338v3"
ara_version: "1.1.0"
domain: "applied-computing / marketing"
keywords:
  - purchase intent
  - synthetic consumers
  - semantic similarity rating
  - LLM
  - Likert scale
  - consumer research
  - zero-shot elicitation
claims_summary: |
  Semantic Similarity Rating (SSR) — mapping free-text LLM responses to Likert distributions via embedding cosine similarity — achieves 90% of human test-retest reliability, with distributional KS similarity > 0.85, outperforming direct Likert elicitation (DLR) and follow-up Likert rating (FLR). Demographic conditioning (especially age, income) is necessary for valid product ranking; without it, distributional similarity increases but concept ranking drops to ρ ≈ 50%.
abstract: |
  Consumer research costs companies billions annually yet suffers from panel biases and limited scale. Large language models (LLMs) offer an alternative by simulating synthetic consumers, but produce unrealistic response distributions when asked directly for numerical ratings. We present semantic similarity rating (SSR), a method that elicits textual responses from LLMs and maps these to Likert distributions using embedding similarity to reference statements. Testing on an extensive dataset comprising 57 personal care product surveys conducted by a leading corporation in that market (9,300 human responses), SSR achieves 90% of human test-retest reliability while maintaining realistic response distributions (KS similarity > 0.85). Additionally, these synthetic respondents provide rich qualitative feedback explaining their ratings.

# Layer Index
- **logic/problem.md**: Research problem and observations
- **logic/claims.md**: Central claims with falsification criteria
- **logic/concepts.md**: Key conceptual definitions
- **logic/experiments.md**: Empirical studies referenced
- **logic/solution/constraints.md**: Limitations and assumptions
- **logic/solution/method-overview.md**: SSR methodology summary
- **logic/related_work.md**: Cited works and their roles
- **src/environment.md**: Paper context
- **trace/exploration_tree.yaml**: Research decision graph
- **evidence/README.md**: Evidence index
- **evidence/tables/**: Table 1 transcript