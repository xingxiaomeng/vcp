# Concepts

## Storytelling Tax
- **Definition**: The systematic erasure of research process knowledge imposed by narrative compilation.
- **Source**: Liu et al. (2026), §1, Fig. 2
- **Quantified cost**: 90.2% of agent dollar cost and 59.2% of tokens on RE-Bench go to failed exploration that published artifacts discard.

## Engineering Tax
- **Definition**: The gap between reviewer-sufficient and agent-sufficient documentation.
- **Source**: Liu et al. (2026), §1, Fig. 3
- **Quantified cost**: Only 45.4% of PaperBench's 8,921 reproduction requirements are fully specified in source PDFs.

## Agent-Native Research Artifact (ARA)
- **Definition**: A file-system protocol recasting the primary research object from narrative document to machine-executable knowledge package organized into four layers: Cognitive (/logic), Physical (/src), Exploration Graph (/trace), Evidence (/evidence).
- **Source**: Liu et al. (2026), §2, Fig. 4
- **Design principle**: *Knowledge over Narrative*.

## Heuristic
- **Definition**: A structured record of a design decision or implementation trick, tagged with rationale, provenance, sensitivity (low/medium/high), bounds, and code reference. Lives in /logic/solution/heuristics.md.
- **Source**: Liu et al. (2026), §2.2, §A.3.4

## Cognitive Layer (/logic)
- **Definition**: Structured scientific reasoning: problem.md, claims.md, concepts.md, experiments.md, related_work.md, solution/.
- **Source**: Liu et al. (2026), §2.2

## Physical Layer (/src)
- **Definition**: Executable code. Two modes: kernel (core modules only) and repository (full annotated implementation).
- **Source**: Liu et al. (2026), §2.2, §A.2

## Exploration Graph (/trace)
- **Definition**: Nested YAML research DAG with five typed node kinds: question, decision, experiment, dead_end, pivot.
- **Source**: Liu et al. (2026), §2.2, Fig. 5

## Evidence Layer (/evidence)
- **Definition**: Raw empirical outputs grounding every claim. Withholding ground-truth prevents fabrication.
- **Source**: Liu et al. (2026), §2.2

## Forensic Binding
- **Definition**: Cross-layer references linking claims to experiments, experiments to evidence, evidence to code.
- **Source**: Liu et al. (2026), §2.2, Fig. 5

## ARA Compiler
- **Definition**: Agent skill for translating legacy sources into ARA format. 4-stage pipeline with in-loop Seal Level 1 validation.
- **Source**: Liu et al. (2026), §4, Fig. 7

## Live Research Manager
- **Definition**: Agent skill capturing research decisions and dead ends as side-effect of AI-native workflows.
- **Source**: Liu et al. (2026), §3, Fig. 6

## ARA Seal
- **Definition**: Three-level machine-verifiable credential: Level 1 (Structural), Level 2 (Rigor), Level 3 (Reproducibility).
- **Source**: Liu et al. (2026), §5, Fig. 8

## Rigor Auditor
- **Definition**: Agent skill implementing Seal Level 2. Six-dimension rubric-anchored evaluation.
- **Source**: Liu et al. (2026), §5.2, §H.2.2

## (Human+AI)^2 Research Network
- **Definition**: Scientific communication system where ARA is the canonical artifact; fork/diff/merge operations.
- **Source**: Liu et al. (2026), §6, Fig. 10

## Progressive Disclosure
- **Definition**: Agent loads only task-relevant layers via PAPER.md layer index (~500 tokens for triage).
- **Source**: Liu et al. (2026), §2.1

## 10-Category Reproduction Information Taxonomy
- **Definition**: Taxonomy from 3,050 PaperBench requirements: experiment matrices (24.1%), evaluation protocol (18.5%), hyperparameters (17.2%), etc.
- **Source**: Liu et al. (2026), §A.1, Table 6

## Kernel Mode vs. Repository Mode
- **Definition**: Physical Layer modes declared in PAPER.md frontmatter (src_mode: kernel|repo).
- **Source**: Liu et al. (2026), §2.2, §A.2