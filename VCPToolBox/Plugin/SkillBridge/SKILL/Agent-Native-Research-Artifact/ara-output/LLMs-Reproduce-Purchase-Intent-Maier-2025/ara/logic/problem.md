# Problem

## Observations

**O01**: Consumer research costs companies billions annually, yet traditional panels suffer from satisficing, acquiescence, positivity biases, and other distortions.
- Source: Maier et al. (2025), §1
- Support: "responses may be distorted by satisficing, acquiescence, and positivity biases, among other factors"

**O02**: Direct Likert elicitation (DLR) from LLMs produces unrealistically narrow distributions — models regress to a 'safe' center (response '3') and almost never use the extremes ('1' or '5').
- Source: Maier et al. (2025), §4.1
- Support: "models typically replied with response '3', i.e. a 'safe' regression to the center of the scale"

**O03**: Despite poor distributional similarity, DLR achieves a surprisingly high correlation attainment (ρ ≈ 80%) solely from occasional '2' and '4' responses — a misleading signal.
- Source: Maier et al. (2025), §4.1
- Support: "The comparably high correlation with real data was therefore purely a result of occasional responses '2' and '4'. Almost never did the models reply with '1' or '5'."

**O04**: Human purchase intent distributions are narrowly concentrated around mean 4.0 (Std ≈ 0.2), making the test-retest ceiling a crucial reference point for evaluating synthetic consumers.
- Source: Maier et al. (2025), §3.1 & §3.3
- Support: "Mean purchase intent is skewed towards positive values and narrowly distributed with mean 4.0 and standard deviation 0.2 across all surveys."

**O05**: LLM-based synthetic consumers can reproduce demographic patterns (age concave behavior, income-level sensitivity) but fail on others (gender, region, ethnicity).
- Source: Maier et al. (2025), §4.3
- Support: "SCs replicated the response behavior less well for gender and dwelling region…mean purchase intent is not being influenced strongly by those features"

**O06**: Synthetic consumers prompted without demographic markers achieve high distributional similarity (KS ≈ 0.91) but lose product-ranking signal (ρ ≈ 50%).
- Source: Maier et al. (2025), §4.3
- Support: "correlation attainment only reached ρ = 50% compared to ρ = 92% for Gem-2f SCs prompted with demographic markers"

**O07**: The SSR method produces rich qualitative feedback as a byproduct — synthetic explanations are far more detailed than human open-ended responses.
- Source: Maier et al. (2025), §4.4 & App. E
- Support: "the free-text responses make it possible to obtain qualitative feedback on product concepts"

## Gaps

**G01**: Is the narrow-distribution problem of LLM survey respondents intrinsic to LLMs, or an artifact of the elicitation method?

**G02**: Can a semantically-informed mapping from free text to Likert scales (SSR) simultaneously achieve high distributional similarity and high concept-ranking correlation?

**G03**: To what extent does demographic conditioning of synthetic consumers actually improve alignment with human survey data — and which demographic dimensions matter?

**G04**: How do zero-shot LLM-based synthetic consumers compare to a supervised ML baseline (LightGBM) trained on demographic and product features?

**G05**: Can the SSR method generalize to survey questions beyond purchase intent (e.g., relevance)?

## Key Insight

The paper's central insight is that the failure of LLMs as survey respondents is not a limitation of the models but of the elicitation protocol. By decoupling the response generation (free text) from the scaling (embedding-based similarity to anchors), SSR resolves the narrow-distribution artifact without sacrificing correlation with human rankings.

## Assumptions

- **A01**: Cosine similarity in the embedding space of "text-embedding-3-small" captures meaningful semantic ordering of purchase intent statements.
- **A02**: Reference statement sets spanning the Likert scale provide a valid anchor gradient for mapping free-text responses to ordinal ratings.
- **A03**: Test-retest reliability on split-half cohorts is an appropriate upper bound for synthetic consumer performance.
- **A04**: The 57 surveys are representative of typical personal care product concept testing in the US market.
- **A05**: LLM responses at T=0.5 are sufficiently stable for the analysis; averaging over 2 samples per prompt yields reliable results.
- **A06**: The Kolmogorov-Smirnov distance, while technically designed for continuous data, is a practically useful distributional similarity metric for ordinal Likert data.