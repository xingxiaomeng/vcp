# Experiments

## E01: METR MALT Exploration Waste Analysis (24,008 runs)
- **Verifies**: [C01, C13]
- **Setup**: Analysis of METR eval-analysis-public dataset covering 24,008 agent runs, 21 frontier models, 228 tasks on RE-Bench.
- **Metrics**: Below-reference run rate, per-run token cost, per-run dollar cost, failed-to-success token ratio (median).
- **Expected outcome**: Failed runs account for 90.2% of dollar cost and 59.2% of tokens. Median failed-to-success token ratio: 113×.
- **Statistical test**: Descriptive statistics (no hypothesis test reported).
- **Source**: Liu et al. (2026), §1, §E.3, Table 10

## E02: PaperBench Information Gap Analysis (8,921 requirements)
- **Verifies**: [C02, C14]
- **Setup**: Classify each of 8,921 expert-annotated reproduction requirements across 23 ICML 2024 papers against the source PDF.
- **Metrics**: % sufficient by task category; gap-type distribution.
- **Expected outcome**: 45.4% sufficient overall; 37.3% for Code Development; missing hyperparameters = 26.2% of all gaps.
- **Statistical test**: Descriptive statistics (64% high-confidence subset dominates headline figure).
- **Source**: Liu et al. (2026), §1, Fig. 3, §E.2, Tables 8-9

## E03: Understanding Evaluation (450 paired QA)
- **Verifies**: [C04, C12]
- **Setup**: 30 targets × 15 questions. Independent Claude Sonnet 4.6 sub-agents per (target, format, question) triple. Graded by Claude Opus 4.6.
- **Metrics**: Overall accuracy; per-category accuracy; per-question token usage; difficulty-stratified accuracy (T1 explicit, T2 scattered, T3 implicit).
- **Expected outcome**: ARA 93.7% vs. baseline 72.4%. +14.8% Cat A, +24.8% Cat B, +65.7% Cat C.
- **Statistical test**: McNemar test on 450 paired outcomes yields χ²=95.15, p<10⁻¹⁰. ARA answers 141 questions correctly that baseline misses; baseline answers only 18 that ARA misses. Wilcoxon signed-rank on per-paper scores: p=0.028.
- **Source**: Liu et al. (2026), §7.2, Table 3, §E, §E.5

## E04: Reproduction Evaluation (15 papers, 150 tasks)
- **Verifies**: [C05]
- **Setup**: 15 PaperBench papers with companion GitHub repos; 10 tasks per paper (1,743 rubric requirements). ARA-only vs. PDF+GitHub agents. Blinded judge.
- **Metrics**: Difficulty-weighted success rate; per-difficulty breakdown; win/tie/loss across papers (8/5/2).
- **Expected outcome**: ARA 64.4% vs. baseline 57.4%. Advantage grows with difficulty: +4.9% easy, +5.6% medium, +8.5% hard. **Fabrication occurred in 2 baseline runs and 1 ARA run (self-expansion), all detected by blinded judge.**
- **Statistical test**: Wilcoxon signed-rank test on 15 paired per-paper weighted scores yields p=0.028. Sign pattern (8-2) under null: p=0.039 (exact binomial).
- **Source**: Liu et al. (2026), §7.3, Fig. 11, Table 11, §F, §F.1

## E05: Extension Evaluation (5 RE-Bench tasks)
- **Verifies**: [C06]
- **Setup**: 5 RE-Bench tasks (triton_cumsum, restricted_mlm, fix_embedding, nanogpt_chat_rl, rust_codecontests). Both agents start from identical workdir. 8h SLURM + $50 API cap. **Harness required 4 engineering fixes for stable 8h trajectories** (Table 13): SDK buffer size crash (max_buffer_size raised 1→16 MiB), OOM killing (PreToolUseBash hook against mass-batch scoring), session silent death (pushback ceiling 1,000 with resume protocol), scorer timeout (per-task timeouts 1,200-10,800s).
- **Metrics**: Best-so-far score vs. wall-clock time and API spend; first useful move timing.
- **Expected outcome**: ARA reaches first useful move earlier on all 5. On 3/5 ARA ends ahead; on 2/5 paper agent overtakes via creative moves not in trace. Weaker model (Sonnet 4.5) inverts comparison.
- **Source**: Liu et al. (2026), §7.4, Fig. 12, §G, Table 13

## E06: ARA Compiler Compilation (30 PaperBench + RE-Bench ARAs)
- **Verifies**: [C07, C15]
- **Setup**: 23 PaperBench ARAs + 7 RE-Bench ARAs compiled using the ARA Compiler. Track iteration counts and failure distribution.
- **Metrics**: First-iteration pass rate, median iterations, per-failure-category distribution.
- **Expected outcome**: 0/30 first-iteration pass rate; all converge within ≤3 iterations. Top failure categories: dangling references (42%), missing schema fields (31%), insufficient node counts (14%).
- **Source**: Liu et al. (2026), §H.2.1

## E07: Live Research Manager Deployment (38 sessions)
- **Verifies**: [C08, C11]
- **Setup**: This paper's own research process (2026-03-12 to 2026-04-26) managed by Live Research Manager.
- **Metrics**: Artifact structure (94 nodes, 16 claims, 18 heuristics, 38 sessions).
- **Expected outcome**: Produces conforming ARA with rich exploration history as natural byproduct.
- **Source**: Liu et al. (2026), §A.3, §C

## E08: ARA Seal Level 1 — Structural Integrity Verification
- **Verifies**: [C09]
- **Setup**: Python script verifying mandatory directories, file presence, schema conformance, minimum counts, cross-layer references. Deterministic checks.
- **Metrics**: Pass/fail per check; failure type distribution.
- **Expected outcome**: All 30 ARAs pass Level 1. 0/30 first-iteration pass rate in Compiler. Level 2 (Argumentative Rigor) runs without executing code; Level 3 uses a coding agent isolated from evidence layer to reproduce claims under a compute budget.
- **Source**: Liu et al. (2026), §5.2, §7.5, §H.2.1

## E09: ARA Seal Level 2 — Rigor Auditor Mutation Benchmark
- **Verifies**: [C09, C10]
- **Setup**: 23 ARAs × 5 injection types (fabricated claim, missing falsification, orphan experiment, over-claim, rebutted-branch leak) = 115 mutations. Rigor Auditor agent matches findings to injection manifest.
- **Metrics**: Per-type detection rate; scoring behavior (grade inflation, finding-score decoupling).
- **Expected outcome**: 100% fabricated claims/over-claims/rebutted-branch leaks; 91% missing falsifications; 22% orphans. Grade inflation in 17/23 ARAs. Finding-score decoupling observed.
- **Source**: Liu et al. (2026), §7.5, Table 4, §H.2.2, Table 14

## E10: Scope and Limitations Analysis
- **Verifies**: [C16]
- **Setup**: Qualitative assessment of ARA's constraints: evaluation scope (ML only), fidelity ceiling (bounded by source supervision), deployment prerequisites (adversarial robustness, schema evolution).
- **Metrics**: N/A.
- **Expected outcome**: Three confirmed limitations. No contradictory evidence.
- **Source**: Liu et al. (2026), §10