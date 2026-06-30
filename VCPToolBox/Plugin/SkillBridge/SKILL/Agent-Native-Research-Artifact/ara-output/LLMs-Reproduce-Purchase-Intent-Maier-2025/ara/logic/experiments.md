# Experiments

## E01: DLR Baseline — GPT-4o (Image, T=0.5)
- **Verifies**: [C01]
- **Setup**: 57 surveys, GPT-4o, full demographics, image stimulus, T=0.5. LLM constrained to output 1/2/3/4/5.
- **Metrics**: ρ = 81.7%; KS = 0.26
- **Expected outcome**: High ρ but very low KS. Models regress to response '3'.
- **Source**: Maier et al. (2025), §4.1, Fig. 2A.i, Fig. 3

## E02: DLR Baseline — Gem-2f (Image, T=0.5)
- **Verifies**: [C01]
- **Setup**: Same as E01 but with Gemini-2.0-flash.
- **Metrics**: ρ = 80.2%; KS = 0.39
- **Expected outcome**: Similar pattern, slightly better KS than GPT-4o.
- **Source**: Maier et al. (2025), §4.1, Fig. 6A.i, Fig. 7

## E03: SSR — GPT-4o (Image, T=0.5)
- **Verifies**: [C01, C02]
- **Setup**: 57 surveys, GPT-4o, full demographics, image stimulus, T=0.5. Free-text → embedding → cosine similarity to 6 anchor sets → averaged pmf.
- **Metrics**: ρ = 90.2%; KS = 0.88; R = 0.72
- **Expected outcome**: Simultaneously high ρ and KS.
- **Source**: Maier et al. (2025), §4.2, Fig. 2A.iii, Fig. 3, Fig. 21

## E04: No-Demographics SSR — GPT-4o (Text, T=0.5)
- **Verifies**: [C03]
- **Setup**: SSR WITHOUT demographic attributes; text stimulus.
- **Metrics**: ρ ≈ 47.4% (avg.); KS ≈ 0.91 (avg.)
- **Expected outcome**: High KS but low ρ. Models default to positive ratings.
- **Source**: Maier et al. (2025), §4.3, Fig. 23-24, Fig. 27

## E05: Demographics vs. No-Demographics — Gem-2f (Image, T=0.5)
- **Verifies**: [C03]
- **Setup**: Gem-2f, image stimulus, full demos vs. no demos.
- **Metrics**: With: ρ = 90.6%, KS = 0.80. Without: ρ = 50.1%, KS = 0.91. Without demos: E[PI] = 4.0 ± 0.1.
- **Expected outcome**: Demographics essential for ranking; without, model defaults to generic positive response.
- **Source**: Maier et al. (2025), §4.3, Fig. 29-31, Table 1

## E06: LightGBM ML Baseline
- **Verifies**: [C04]
- **Setup**: 300 iterations, 28-train / 29-test splits. 5 demographic + 3 concept features.
- **Metrics**: ρ = 64.6 ± 1.0%; KS = 0.797 ± 0.002
- **Expected outcome**: Supervised ML with training data still underperforms zero-shot LLM.
- **Source**: Maier et al. (2025), §4.4, App. D

## E07: Qualitative Analysis of Synthetic Responses
- **Verifies**: [C05]
- **Setup**: Human vs. LLM free-text responses for purchase intent.
- **Metrics**: Qualitative. Human: short ("It's good"). LLM: detailed rationales.
- **Expected outcome**: Synthetic responses richer, less positivity-biased.
- **Source**: Maier et al. (2025), §4.4, App. E

## E08: Stimulus Type Comparison — Text vs. Image
- **Verifies**: [C01, C02]
- **Setup**: Text-only vs. full image stimulus across both models.
- **Metrics**: Image yields slightly higher ρ; text-only mildly reduces performance.
- **Expected outcome**: Text sufficient for most of the SSR effect.
- **Source**: Maier et al. (2025), Table 1

## E09: Generalization to "Relevance" Question — Gem-2f
- **Verifies**: [C06]
- **Setup**: Question "How relevant?" with 3 new reference sets. Gem-2f, image, T=0.5.
- **Metrics**: SSR: ρ = 82%, KS = 0.81; FLR: ρ = 91%, KS = 0.62
- **Expected outcome**: SSR generalizes to other Likert constructs.
- **Source**: Maier et al. (2025), §4.4, Fig. 33-35

## E10: Temperature Parameter Scan (T scan)
- **Verifies**: [C07]
- **Setup**: GPT-4o SSR, T scan 0.1 to 2.0.
- **Metrics**: As T↑, KS↑ and ρ↓ (trade-off). T≈1 is default.
- **Expected outcome**: Pareto frontier; T=1 near knee.
- **Source**: Maier et al. (2025), App. A.4.3, Fig. 32

## E11: Demographic Subgroup Analysis (Fig 4)
- **Verifies**: [C08]
- **Setup**: SSR mean PI stratified by (A) age, (B) income, (C) category, (D) source, (E) price tier, plus gender and region. GPT-4o and Gem-2f vs. human.
- **Metrics**: (A) Age — concave pattern replicated by both models. (B) Income — budget sensitivity replicated. (C-E) Category, source, price tier — orderings replicated. Gender and region — not replicated.
- **Expected outcome**: Age and income gradients captured well; gender and region not captured.
- **Source**: Maier et al. (2025), §4.3, Fig. 4, Fig. 8