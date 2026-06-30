# Heuristics

## H01: Directional verification over exact matching
- **Rationale**: Legacy papers routinely omit details needed for exact reproduction. Verifying directional properties (A > B on metric X) demonstrates the code kernel captures the core algorithmic insight without requiring exact numerical matches.
- **Provenance**: user
- **Sensitivity**: medium
- **Code ref**: Liu et al. (2026), §5.2

## H02: Minimal kernel = algorithm notes with inline snippets, not raw code files
- **Rationale**: Full code dumps (200-700 lines) cause context dilution — the agent spends tokens parsing boilerplate already described in official solution notes. Notes contain core algorithm with key code snippets inline, sufficient for comprehension while 5-10× smaller (kernel mode).
- **Provenance**: user-revised
- **Sensitivity**: high
- **Code ref**: Liu et al. (2026), §2.2, §A.2

## H03: Progressive disclosure via layer index triage
- **Rationale**: Agent context windows are finite. PAPER.md's layer index (~500 tokens) lets an agent load only the layers relevant to its current task, avoiding unnecessary context pollution.
- **Provenance**: user
- **Sensitivity**: medium
- **Code ref**: Liu et al. (2026), §2.1, §E.4

## H04: Evidence withholding prevents fabrication
- **Rationale**: Separating experiment logic (in /logic/experiments.md) from ground-truth results (in /evidence/) means a verification agent can be granted the code kernel and algorithm descriptions while the evidence layer is withheld, preventing fabrication by copying expected values.
- **Provenance**: user
- **Sensitivity**: high
- **Code ref**: Liu et al. (2026), §2.2

## H05: Dead_end nodes preserve structured failure knowledge
- **Rationale**: Raw dead ends are information-dense but unstructured. Promoting them to first-class dead_end nodes with hypothesis, failure_mode, and lesson fields makes negative knowledge machine-queryable and actionable by downstream agents.
- **Provenance**: user
- **Sensitivity**: medium
- **Code ref**: Liu et al. (2026), §2.2, Fig. 5

## H06: Live capture at session boundaries, never mid-turn
- **Rationale**: Interrupting active research for documentation breaks flow. Running capture at session boundaries (conversation end → extract → classify → crystallize) preserves the trajectory without interfering with the research itself.
- **Provenance**: user
- **Sensitivity**: low
- **Code ref**: Liu et al. (2026), §3.2

## H07: Maturity tracking through closure signals, not counters
- **Rationale**: A counter-based threshold (promote after N references) is arbitrary. Closure signals — topic abandonment, verbal affirmation, empirical resolution, artifact commitment — provide externally observable patterns that the researcher has treated an observation as settled.
- **Provenance**: user
- **Sensitivity**: medium
- **Code ref**: Liu et al. (2026), §C.2

## H08: Level 1 as in-loop validation feedback, not post-hoc report
- **Rationale**: Running Seal Level 1 checks within the same Compiler conversation and returning failures as structured diagnostics drives targeted fixes. The generate→validate→fix loop typically converges in 2–3 rounds.
- **Provenance**: user
- **Sensitivity**: low
- **Code ref**: Liu et al. (2026), §4.2, §H.2.1

## H09: LLMs should generate findings, not grades
- **Rationale**: The Rigor Auditor's scoring exhibits grade inflation (17/23 ARAs) and finding-score decoupling. LLMs are good at producing structured findings but poor at calibrated numeric scoring. Grades should be computed deterministically from findings.
- **Provenance**: ai-suggested
- **Sensitivity**: medium
- **Code ref**: Liu et al. (2026), §7.5, §H.2.2