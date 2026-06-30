# Related Work

## LLMs as Synthetic Survey Respondents
- **Bisbee et al. (2024)** — *Synthetic replacements for human survey data?*: Direct Likert elicitation produces narrow distributions, over-confident estimates. *Role in paper*: Primary motivation — identifies the narrow-distribution problem. [SUPPORTS] O02.
- **Argyle et al. (2023)** — *Out of one, many*: Demographic conditioning improves alignment with human benchmarks. *Role in paper*: Supports demographic conditioning strategy. [SUPPORTS] C03.
- **Brand, Israeli & Ngwe (2024)** — *Using LLMs for market research*: Conjoint-style willingness-to-pay estimation; uses fine-tuning. *Role in paper*: Contemporaneous work in marketing. [BACKGROUND].
- **Salecha et al. (2024)** — *LLMs show human-like social desirability biases*: Direct Likert elicitation shows biased distributions. *Role in paper*: Further evidence of DLR shortcomings. [SUPPORTS] O01, O02.
- **Kaiser et al. (2025)** — *Simulating human opinions with LLMs*: Challenges with personalized survey data. *Role in paper*: Acknowledges broader challenges. [BACKGROUND].
- **Aher, Arriaga & Kalai (2023)** — *Using LLMs to simulate multiple humans*: Behavioral games, zero-shot elicitation. *Role in paper*: Zero-shot approach precedent. [BACKGROUND].

## Text-to-Score Mapping Approaches
- **Li et al. (2024)** — *LLMs for automated perceptual analysis*: Open completions mapped to similarity scores by counting elicited brand completions. *Role in paper*: Precedent for textual→numerical mapping in marketing. [REFINES] SSR concept.
- **Cho, Kim & Kim (2024)** — *LLM-based doppelgänger models*: Generate free-text survey answers aligned with structured categories. *Role in paper*: Another text→score pipeline, but uses fine-tuning. [REFINES].
- **Jansen, Jung & Salminen (2023)** — *Employing LLMs in survey research*. *Role in paper*: Broader context. [BACKGROUND].

## Semantic Similarity in NLP
- **Yin, Hay & Roth (2019)** — *Benchmarking zero-shot text classification*. *Role in paper*: Establishes the embedding-based similarity mapping foundation. [FOUNDATION] of SSR.

## Anchoring Methods in Survey Methodology
- **King et al. (2004)** — *Enhancing validity in survey research*: Anchoring vignettes. *Role in paper*: Methodological precedent for using anchors to map responses. [FOUNDATION].

## Methodological Precedents
- **Likert (1932)** — *A technique for the measurement of attitudes*. *Role in paper*: Original Likert scale definition. [FOUNDATION].
- **Krosnick (1991, 1999)** — Survey response biases (satisficing, acquiescence). *Role in paper*: Documents human survey limitations that motivate synthetic alternatives. [SUPPORTS] O01.

## Baseline Comparison
- **Ke et al. (2017)** — *LightGBM*. *Role in paper*: Supervised ML baseline for comparison. [BENCHMARK].
- **LightGBM analysis in App. D**: Trained on 28 surveys, tested on 29, 300 iterations. *Role in paper*: Demonstrates that zero-shot LLM methods outperform supervised alternatives. [SUPPORTS] C04.