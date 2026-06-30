# Claims

## C01: Scientific publication imposes a Storytelling Tax by systematically erasing failure knowledge
- **Statement**: Narrative publication discards the true branching research process — failed experiments, rejected hypotheses, and design pivots are systematically erased — creating a Storytelling Tax borne by every downstream consumer who must rediscover these dead ends independently.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A comprehensive analysis of 100+ published papers finds that at least 80% document at least one specific failed experiment, rejected hypothesis, or abandoned approach in sufficient detail for independent replication of the failure. (Threshold derived from the PaperBench gap analysis: across 8,921 reproduction requirements, only 45.4% are fully specified in source PDFs — the inverse implies that at least 54.6% of requirements involve knowledge that narrative publication discards or underspecifies.)
- **Proof**: [E01]
- **Dependencies**: []
- **Tags**: storytelling tax, failure knowledge, narrative compilation
- **Last revised**: 2026-06-13 (Level 2 review)

## C02: Scientific publication imposes an Engineering Tax due to underspecified documentation
- **Statement**: The gap between reviewer-sufficient prose and agent-sufficient specification leaves critical implementation details unwritten. Across PaperBench's 8,921 requirements, only 45.4% are fully specified in the source PDF; missing hyperparameters alone account for 26.2% of all gaps.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A systematic audit of 20+ papers from a top ML venue shows that at least 80% of reproduction-critical details are explicitly and completely specified in the paper text.
- **Proof**: [E02]
- **Dependencies**: []
- **Tags**: engineering tax, information gap, PaperBench, hyperparameters
- **Last revised**: 2026-05-19

## C03: The ARA protocol (four interlocking layers plus three enabling mechanisms) resolves both the Storytelling Tax and the Engineering Tax
- **Statement**: By recasting the primary research object through the ARA protocol — four interlocking layers (Cognitive /logic, Physical /src, Exploration Graph /trace, Evidence /evidence) supported by three enabling mechanisms (Live Research Manager, ARA Compiler, ARA-Native Review System) — the protocol addresses both the Storytelling Tax (via the Exploration Graph preserving failure knowledge) and the Engineering Tax (via structured Cognitive and Physical layers closing the specification gap).
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A controlled experiment comparing an agent operating on an ARA vs. the same agent on the source PDF+repo shows that the ARA agent does NOT outperform on either understanding accuracy or reproduction success rate.
- **Proof**: [E03, E04, E05]
- **Dependencies**: [C01, C02]
- **Tags**: ARA protocol, four layers, three mechanisms, problem-solution mapping
- **Last revised**: 2026-06-13 (Level 2 review)

## C04: ARA achieves higher knowledge extraction accuracy than PDF+repo (93.7% vs. 72.4%)
- **Statement**: On 450 paired questions across 30 targets, agents on ARA achieve 93.7% overall accuracy vs. 72.4% for baseline — +21.3%. Advantage consistent across all categories: fidelity (+14.8%), configuration recovery (+24.8%), failure knowledge (+65.7%).
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A replication study on an independent set of 20+ papers from a different venue shows ARA advantage < +10% overall.
- **Proof**: [E03]
- **Dependencies**: [C03]
- **Tags**: understanding, knowledge extraction, QA accuracy
- **Last revised**: 2026-05-19

## C05: ARA achieves higher reproduction success than PDF+GitHub (64.4% vs. 57.4%)
- **Statement**: On 15 PaperBench papers (150 tasks, 1,743 rubric requirements), ARA achieves 64.4% vs. 57.4% baseline — +7.0%. Advantage grows with difficulty (+4.9% easy, +5.6% medium, +8.5% hard).
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: An independent study on 15+ papers shows ARA's weighted success rate is NOT significantly different from baseline (p > 0.05).
- **Proof**: [E04]
- **Dependencies**: [C03, C04]
- **Tags**: reproduction, PaperBench, code execution
- **Last revised**: 2026-05-19

## C06: Preserved failure traces accelerate extension but can constrain capable agents
- **Statement**: On 5 RE-Bench tasks, ARA agents reach first useful move earlier on all 5. However, on triton_cumsum and restricted_mlm under Sonnet 4.6, faithful adherence to trace-recommended designs causes ARA to fall behind baseline agents that independently discover more creative solutions.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: Re-analysis shows ARA agent ends with better best score on ALL 5 tasks.
- **Proof**: [E05]
- **Dependencies**: [C03]
- **Tags**: extension, RE-Bench, failure traces, creative constraint
- **Last revised**: 2026-05-19

## C07: ARA Compiler translates legacy PDFs and repos into conforming ARAs
- **Statement**: The ARA Compiler translates any combination of PDFs, code repos, evaluation rubrics, and trajectory logs into ARA through a top-down 4-stage pipeline, with quality enforced by in-loop Seal Level 1 validation converging in 1 to 3 iterations.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: Compiling 10+ legacy PDF+repo pairs produces artifacts requiring more than 5 iterations to pass Level 1.
- **Proof**: [E06]
- **Dependencies**: [C03]
- **Tags**: ARA Compiler, skill specification, legacy conversion
- **Last revised**: 2026-05-19

## C08: Live Research Manager captures decisions and dead ends as side-effect of AI-native workflows
- **Statement**: The Live Research Manager (agent skill) runs silently at session boundaries with a 3-stage pipeline (Context Harvester to Event Router to Maturity Tracker), crystallizing research trajectory data into structured ARA layers without additional documentation burden.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A 30-day deployment in an active project produces an artifact that misses more than 50% of significant decisions the researcher recalls.
- **Proof**: [E07]
- **Dependencies**: [C03]
- **Tags**: Live Research Manager, trajectory capture, AI-native workflows
- **Last revised**: 2026-05-19

## C09: ARA Seal provides three-level machine-verifiable research credentials
- **Statement**: The ARA Seal is a three-level verification protocol: Level 1 (Structural Integrity) checks schema conformance and cross-layer reference resolution; Level 2 (Argumentative Rigor) evaluates six epistemic dimensions scored 1 to 5 via a Rigor Auditor agent; Level 3 (Execution Reproducibility) runs scaled-down directional checks on central claims. Levels gate each other in a CI/CD-style pipeline.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A manually verified artifact known to contain structural errors passes Level 1, or an artifact whose central claims are known to be false passes Level 2.
- **Proof**: [E08, E09]
- **Dependencies**: [C03]
- **Tags**: ARA Seal, verification, reproducibility, review pipeline
- **Last revised**: 2026-05-19

## C10: The Rigor Auditor detects high-severity anomalies reliably but has a blind spot on orphan experiments
- **Statement**: On a mutation benchmark of 23 ARAs by 5 injection types (115 mutations), the Rigor Auditor detects 100% of fabricated claims, rebutted-branch leaks, and over-claims; 91% of missing falsifications; but only 22% of orphan experiments. The auditor also exhibits grade inflation and finding-score decoupling.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A re-run of the mutation benchmark shows the auditor detecting less than 80% of fabricated claims, or detecting more than 50% of orphan experiments.
- **Proof**: [E09]
- **Dependencies**: [C09]
- **Tags**: Rigor Auditor, mutation benchmark, LLM-as-judge
- **Last revised**: 2026-05-19

## C11: ARA enables a (Human+AI)^2 research network with fork/diff/merge semantics
- **Statement**: Composing the ARA protocol, Live Research Manager, Compiler, and Seal-gated review pipeline forms a scientific communication system where the primary object is the ARA itself: researchers pursue questions and the artifact accrues automatically; consumers fork passing artifacts, extend claims, and submit diffs for re-review.
- **Status**: hypothesis
- **Provenance**: user
- **Falsification criteria**: A pilot deployment with 5+ research groups finds that the fork/submit/merge workflow cannot be sustained for even a single cross-group collaboration cycle.
- **Proof**: [E07]
- **Dependencies**: [C03, C08, C09]
- **Tags**: (Human+AI)^2 network, fork, collaboration infrastructure
- **Last revised**: 2026-05-19

## C12: Progressive disclosure via layer index reduces agent token usage while improving accuracy
- **Statement**: ARA's PAPER.md provides a layer index enabling an agent to triage relevance in about 500 tokens and load only task-relevant layers. On Category A (fidelity) questions, ARA consumes 12% fewer tokens than baseline while achieving +14.8% higher accuracy. On implicit questions, ARA invests more tokens productively (153K vs. 118K) for +30.5% accuracy.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A token audit on 100+ independent queries shows ARA consumes MORE total tokens per query than reading the PDF linearly.
- **Proof**: [E03]
- **Dependencies**: [C03, C04]
- **Tags**: progressive disclosure, layer index, token efficiency
- **Last revised**: 2026-05-19

## C13: 90.2% of RE-Bench agent spend goes to failed exploration that published artifacts discard
- **Statement**: Across 24,008 agent runs on RE-Bench (21 models, 228 tasks), 90.2% of dollar cost and 59.2% of tokens are spent in runs that did not reach the reference score. The median failed-to-success token ratio is 113x. This exploration only becomes wasted compute when subsequent agents lack access to the failure record.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: Re-analysis of the same METR MALT corpus finds that the failed-to-success token ratio is less than 10x, or that below-reference spend accounts for less than 50% of total cost.
- **Proof**: [E01]
- **Dependencies**: []
- **Tags**: exploration waste, RE-Bench, METR MALT, cost analysis
- **Last revised**: 2026-05-19

## C14: Ten reproduction-critical information categories reveal hyperparameters dominate gaps
- **Statement**: A taxonomy derived from 3,050 leaf requirements across 5 PaperBench papers identifies 10 reproduction-critical information categories. The largest is combinatorial experiment matrices (24.1%), followed by evaluation protocol (18.5%) and hyperparameters (17.2%). Missing hyperparameters account for 26.2% of all information gaps across 8,921 requirements.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: An independent taxonomy derivation on 10+ papers from a different venue finds a significantly different category distribution.
- **Proof**: [E02]
- **Dependencies**: [C02]
- **Tags**: information taxonomy, PaperBench, reproduction requirements
- **Last revised**: 2026-05-19

## C15: Physical Layer has two modes — kernel and repository — calibrated to contribution type
- **Statement**: The ARA Physical Layer adopts one of two modes. Kernel mode (for algorithmic contributions) contains only core modules with typed I/O, 1 to 2 orders of magnitude smaller than the full repo. Repository mode (for systemic contributions) retains the full implementation annotated via an index.md manifest.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A representative sample of 10+ research codebases cannot be cleanly classified into either kernel or repository mode, or the mode classification leads to worse reproduction outcomes than a single unified approach.
- **Proof**: [E06, E07]
- **Dependencies**: [C03]
- **Tags**: Physical Layer, kernel mode, repository mode, code decomposition
- **Last revised**: 2026-05-19

## C16: ARA's claims are bounded by evaluation scope, fidelity ceiling, and deployment prerequisites
- **Statement**: ARA's evaluation covers only machine learning papers; generalization to wet-lab or theoretical disciplines is untested. ARA fidelity is bounded by source supervision (the Compiler cannot recover what the PDF omits). Two production prerequisites — adversarial robustness and schema evolution — are not yet implemented. Additionally, all primary evaluations use Claude models only; cross-model replication with GPT, Gemini, or Llama has not been performed.
- **Status**: supported
- **Provenance**: user
- **Falsification criteria**: A successful deployment of ARA in a wet-lab biology setting with no computational component matches the gains reported in the ML evaluation.
- **Proof**: [E10]
- **Dependencies**: []
- **Tags**: limitations, evaluation scope, fidelity ceiling, deployment prerequisites, single-model limitation
- **Last revised**: 2026-06-13 (Level 2 review)