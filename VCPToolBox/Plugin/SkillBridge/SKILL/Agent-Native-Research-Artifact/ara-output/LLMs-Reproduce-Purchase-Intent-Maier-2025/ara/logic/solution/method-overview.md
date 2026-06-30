# Method Overview: SSR Pipeline

## Three Elicitation Strategies (Fig. 1A)

```
Product Concept (image or text) + Demographic Persona
                    │
                    ▼
         ┌──────────────────────┐
         │     Synthetic Consumer (LLM)   │
         └──────────────────────┘
                    │
         ┌─────────┼─────────────┐
         ▼         ▼             ▼
       DLR        FLR          SSR
    (direct     (text →      (text →
     integer)   LLM-rating)   embedding → 
                              cosine sim.
                              to anchors)
```

### 1. Direct Likert Rating (DLR)
- LLM constrained to output 1, 2, 3, 4, or 5
- **Result**: KS ≈ 0.26 (GPT-4o), ρ ≈ 80%
- **Issue**: Almost never uses '1' or '5'; safe center regression

### 2. Follow-up Likert Rating (FLR)
- Two-step: (a) generate free text → (b) new LLM instance as "Likert expert" maps to integer
- **Result**: KS ≈ 0.72 (GPT-4o), ρ ≈ 85%

### 3. Semantic Similarity Rating (SSR) — Proposed Method
- Step 1: Generate free-text purchase intent response (unconstrained)
- Step 2: Retrieve embedding vector via "text-embedding-3-small"
- Step 3: Compute cosine similarity to 6 sets of 5 anchor statements
- Step 4: Convert similarities to pmf: p(r) ∝ [cos_sim - min_sim + εδ_lr]
- Step 5: Average over 6 reference sets; optional temperature T
- **Result**: KS ≈ 0.88 (GPT-4o), ρ ≈ 90%

## Data
- 57 personal care surveys, 9,300 participants (150–400/survey)
- 5pt Likert purchase intent; demographics: age, gender, location, income, ethnicity

## Models
- **GPT-4o** (primary), **Gemini-2.0-flash** (replication)
- T_LLM = 0.5 (main), T_LLM = 1.5 (comparison); 2 samples per prompt

## Stimulus Types
- **Image**: Full concept slide; **Text**: Description only (transcribed via GPT-4o)
- **Finding**: Text-only slightly reduces performance but doesn't change conclusions

## Metrics
1. **KS similarity**: 1 - KS_distance(CDF_synthetic, CDF_human)
2. **Correlation attainment ρ**: E[R_xy] / E[R_xx] (test-retest ceiling, 2,000 simulations)

## Code
- Full Python implementation: https://github.com/pymc-labs/semantic-similarity-rating