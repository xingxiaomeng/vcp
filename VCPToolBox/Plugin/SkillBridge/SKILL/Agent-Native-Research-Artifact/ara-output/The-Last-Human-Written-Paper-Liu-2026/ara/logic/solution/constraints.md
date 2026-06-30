# Constraints

## Limitations of the Paper

- **L01 — Evaluation scope is ML-only**: The study covers only machine learning papers where computational reproducibility and well-defined contribution types make ARA's four-layer structure a natural fit. Generalization to wet-lab sciences (physical execution requirements) or theoretical disciplines (no Physical Layer) is empirically untested.
- **L02 — Fidelity ceiling bounded by source supervision**: The Compiler faithfully represents only what the PDF contains. When a paper omits details, no extraction method can recover them. The Live Research Manager closes this gap for AI-native workflows but is unavailable for legacy papers.
- **L03 — Deployment prerequisites not yet implemented**: Adversarial robustness, privacy guarantees, sandboxed execution, content-level anomaly detection, and granular access control for the Exploration Graph are aspirational.
- **L04 — Schema evolution untested**: The ARA schema will need to add node types, refine field semantics, and deprecate conventions as research practice changes. Versioning via `ara_schema` tag and forward/backward compatibility have only been exercised across minor revisions.
- **L05 — Human-annotated benchmark bias**: The human-annotated benchmark was constructed by annotators familiar with both the ARA format and the selected papers; performance on unfamiliar or niche-domain artifacts may differ.
- **L06 — Rigor Auditor score-finding decoupling**: The LLM-as-judge auditor exhibits grade inflation (17/23 ARAs) and finding-score decoupling (critical flags do not propagate to dimension scores). LLMs should generate findings rather than grades.
- **L07 — (Human+AI)^2 network speculative**: The fork/diff/merge workflow for cross-group collaboration is proposed but not empirically validated.

## Assumptions

- **A01**: CS/ML is the primary domain; wet-lab/theoretical adaptation may be substantial.
- **A02**: AI-native workflows (researcher + coding agent) will continue to grow.
- **A03**: ARA sufficiency is capability-relative.
- **A04**: Agent context windows are a shared, finite resource.
- **A05**: The three-level ARA Seal provides sufficient verification.
- **A06**: Progressive disclosure via layer index is the correct approach for context management.

## Boundaries of Claims

- Claims are about ML research artifacts specifically
- Gains measured against the PDF+repo baseline, not absolute performance
- "ARA achieves X%" means relative to the status quo of narrative publication
- Claims about live deployment and ecosystem-level adoption (fork/merge/collaboration) are hypothetical (C11)
- Not claimed: ARA is a universal format for all scientific communication