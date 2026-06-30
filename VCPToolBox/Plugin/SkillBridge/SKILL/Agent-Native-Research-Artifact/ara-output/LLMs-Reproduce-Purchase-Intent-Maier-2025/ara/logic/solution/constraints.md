# Constraints

## Limitations of the Paper

- **L01 — Reference set dependency**: SSR relies on manually designed reference statement sets, optimized for this specific set of 57 surveys. It remains unclear how well they would perform for other surveys or domains.
- **L02 — Demographic coverage is incomplete**: LLMs captured age and income patterns but failed on gender, region, and ethnicity. Persona conditioning is not yet a reliable proxy for all subpopulations.
- **L03 — Knowledge domain boundedness**: SSR's validity depends on the LLM's training data containing adequate information about the survey domain. For domains without abundant consumer discussions (e.g., niche B2B products), SSR may hallucinate.
- **L04 — No real-world purchasing contingencies**: Synthetic consumers cannot capture budget constraints, cultural context, marketing exposure, or other real-world factors affecting actual purchase behavior.
- **L05 — Embedding model dependency**: SSR uses "text-embedding-3-small"; results may vary with alternative embedding models. Domain-specific encoders remain unexplored.
- **L06 — Narrow mean purchase intent range**: Human PI means are tightly clustered (4.0 ± 0.2), making the correlation metric sensitive and the test-retest ceiling a critical reference.
- **L07 — Single-company, single-category data**: 57 surveys all from one corporation in personal care. Generalization to other industries and geographies is untested.
- **L08 — Response stability**: The paper uses n=2 samples per prompt. While stated as "sufficient", the stability of results across larger numbers of samples was not systematically tested.
- **L09 — SSR temperature not optimized**: The paper uses T=1 as a rule of thumb, acknowledges optimization potential, but does not provide a principled method for selecting T.

## Assumptions Made in the Paper

- **A01** (from problem.md): Cosine similarity in embedding space captures meaningful semantic ordering.
- **A02**: Anchor statements provide a valid gradient.
- **A03**: Test-retest ceiling is an appropriate upper bound.
- **A04**: 57 surveys are representative of personal care concept testing.
- **A05**: T_LLM = 0.5, n=2 samples are sufficient.
- **A06**: KS distance is practically useful for ordinal Likert data.

## Boundaries of Claims

- Claims apply to US-market personal care product concept testing
- Claims are about zero-shot LLM performance (no fine-tuning)
- SSR is not proposed as a wholesale replacement for human research, but as an augmentation/screening tool
- The "90% of human reliability" claim is relative to the test-retest ceiling, not absolute correlation