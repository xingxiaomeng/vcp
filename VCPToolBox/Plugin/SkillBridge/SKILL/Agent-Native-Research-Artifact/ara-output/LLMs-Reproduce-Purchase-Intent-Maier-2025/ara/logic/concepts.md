# Concepts

## Semantic Similarity Rating (SSR)
- **Definition**: A method that elicits free-text responses from LLMs (conditioned on demographic personas and product concepts) and maps them to a probability mass function over the 5-point Likert scale by computing cosine similarity between the response's embedding vector and pre-defined anchor statement embeddings for each Likert category.
- **Source**: Maier et al. (2025), §3.4 & Fig. 1
- **Role in paper**: Core methodological contribution — the proposed solution to the narrow-distribution problem.
- **Implementation**: Embedding model = "text-embedding-3-small" (OpenAI); 6 reference statement sets averaged per response; similarity-to-probability mapping subtracts minimum similarity and normalizes; optional temperature parameter T controls distribution spread.

## Direct Likert Rating (DLR)
- **Definition**: The naive baseline where the LLM is prompted to reply directly with a single integer Likert rating (1, 2, 3, 4, or 5), with output tokens constrained to these values.
- **Source**: Maier et al. (2025), §3.4
- **Role in paper**: Baseline method demonstrating the narrow-distribution artifact (KS ≈ 0.26–0.39).

## Follow-up Likert Rating (FLR)
- **Definition**: A two-step method where the LLM first generates a free-text purchase intent statement, then a new instance of the same model (prompted as "Likert rating expert") maps the text to an integer Likert score. The expert system prompt includes examples of statement-to-rating mappings.
- **Source**: Maier et al. (2025), §3.4
- **Role in paper**: Intermediate baseline — outperforms DLR but falls short of SSR (KS ≈ 0.59–0.72).

## Correlation Attainment (ρ)
- **Definition**: A success metric quantifying how close the Pearson correlation between synthetic and human mean purchase intents is to the human test-retest ceiling. ρ = E[R_xy] / E[R_xx], where R_xy is the real-synthetic correlation and R_xx is the test-retest correlation (computed by splitting each survey into two equal cohorts, 2,000 simulations).
- **Source**: Maier et al. (2025), §3.3
- **Role in paper**: Primary metric for concept-ranking performance — accounts for the narrow range of human mean PI.

## Test-Retest Ceiling (R_xx)
- **Definition**: The maximum achievable correlation between two independent administrations of the same survey to different human cohorts of the same size. Estimated by 2,000 random split-half simulations per survey.
- **Source**: Maier et al. (2025), §3.3
- **Role in paper**: Provides a realistic upper bound for synthetic consumer evaluation — avoids the naive expectation that perfect correlation (R = 1.0) is achievable.

## KS Similarity (Distributional Similarity)
- **Definition**: A per-survey metric defined as KS_sim = 1 - KS_dist, where KS_dist is the Kolmogorov-Smirnov distance between the CDFs of synthetic and real Likert responses.
- **Source**: Maier et al. (2025), §3.3
- **Role in paper**: Secondary success metric measuring how closely synthetic response distributions match human distributions.

## Reference Statement Sets
- **Definition**: Six sets of 5 anchor statements each (one per Likert category 1–5), designed to span the purchase intent spectrum from "very unlikely to buy" to "very likely to buy." Written as generic, domain-independent statements. Responses are compared to each anchor via cosine similarity; results are averaged across sets.
- **Source**: Maier et al. (2025), §3.4 & App. C.1
- **Role in paper**: The semantic "ruler" against which free-text responses are measured — critical for SSR's validity.

## Synthetic Consumer (SC)
- **Definition**: An LLM instance prompted to impersonate a human survey respondent with a given set of demographic attributes (age, gender, location, income, ethnicity), shown a product concept, and asked about purchase intent.
- **Source**: Maier et al. (2025), §3.4
- **Role in paper**: The unit of analysis — each SC generates one textual response and/or rating per query.

## LightGBM Baseline
- **Definition**: Gradient-boosted decision tree classifiers trained on demographic features (5) and concept attributes (3) to predict individual Likert ratings, used as a supervised ML comparison against zero-shot LLM elicitation.
- **Source**: Maier et al. (2025), App. D
- **Role in paper**: Demonstrates that zero-shot LLM methods outperform supervised alternatives despite having no training data access.

## Heyneman-Loxley Effect
- **Note**: This concept appears in the previous compiled paper (Detterman, 2016) but is not discussed in Maier et al. (2025). Included here as a placeholder if cross-paper comparison is desired.