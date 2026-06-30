# Problem

## Observations

**O01**: Scientific publication compresses a branching research process into a linear narrative, discarding failed experiments, tacit engineering knowledge, and the branching exploration process.
- Source: Liu et al. (2026), §1
- Support: "Publishing compiles this object into a linear narrative, discarding failed experiments, tacit engineering knowledge, and the branching process to satisfy the conventions of human-readable storytelling."

**O02**: Failed agent runs on RE-Bench account for 90.2% of total dollar cost (and 59.2% of tokens), with a median failed-to-success token ratio of 113×.
- Source: Liu et al. (2026), §1, §E.3
- Support: "failed runs account for 90.2% of total dollar cost (and 59.2% of tokens), with a median failed-to-success token ratio of 113×"

**O03**: Across PaperBench's 8,921 expert-annotated reproduction requirements across 23 ICML 2024 papers, only 45.4% are fully specified in the source PDF. Code development is the most underspecified category (37.3% sufficient), and missing hyperparameters alone account for 26.2% of all gaps.
- Source: Liu et al. (2026), §1, Fig. 3, §E.2
- Support: "only 45.4% are fully specified… Code development is the most underspecified category (37.3% sufficient)… missing hyperparameters alone account for 26.2% of all gaps"

**O04**: Even the strongest frontier LLMs correctly implement fewer than 40% of novel research contributions when given the full paper and codebase.
- Source: Liu et al. (2026), §A.3.3 (citing Hua et al. 2025, ResearchCodeBench)
- Support: "Even the strongest frontier LLMs correctly implement fewer than 40% of novel research contributions"

**O05**: LLM adoption is associated with paper-production increases of 23.7%–89.3% across scientific fields, and the full research trajectory is now captured as machine-readable text in researcher-agent sessions, yet no protocol preserves it as a first-class output.
- Source: Liu et al. (2026), §1 (citing Kusumegi et al. 2025)
- Support: "the full research trajectory (every failure, implementation trick, configuration choice, design pivot) is now captured as machine-readable text in researcher-agent sessions, yet no protocol preserves it as a first-class output."

## Gaps

**G01 — Storytelling Tax**: Failed experiments, rejected hypotheses, and the branching exploration process are discarded to fit a linear narrative, forcing independent rediscovery of the same dead ends across groups.

**G02 — Engineering Tax**: The gap between reviewer-sufficient prose (sufficient to produce belief) and agent-sufficient specification (sufficient to produce correct execution) leaves critical implementation details unwritten, existing only as tacit knowledge transmitted through lab contact.

**G03 — No existing tool jointly structures scientific logic, executable code, and exploration history**: FAIR principles address data metadata but not argument structure. RO-Crate packages research artifacts as archival bundles, not executable objects. Nanopublications lack an execution layer. AGENTS.md standardizes agent-oriented docs but not epistemic structure.

**G04 — Unidirectional artifact flow**: Narrative PDFs cannot be forked, diffed, or merged, preventing research from compounding like software.

## Key Insight

The paper's central insight is that the cost of AI doing research is no longer inference but wasted re-exploration. Because the full research trajectory already exists as machine-readable text in AI-native workflows, a structured artifact that preserves claims, code, evidence, and failure history as interoperable layers eliminates both the Storytelling Tax and the Engineering Tax at negligible marginal cost.

## Assumptions

- **A01**: Computer science research (particularly machine learning) is the primary domain; generalization to wet-lab sciences or theoretical disciplines may require substantial adaptation.
- **A02**: AI-native workflows (researcher + coding agent) will continue to grow, providing the natural source of trajectory data for the Live Research Manager.
- **A03**: Sufficiency of an ARA is a capability-relative criterion: "when a sufficiently capable coding agent can reproduce the core claim zero-shot from it."
- **A04**: Agent context windows are a shared, finite resource; progressive disclosure matters.
- **A05**: The three-level ARA Seal (structural integrity → argumentative rigor → execution reproducibility) provides sufficient verification.