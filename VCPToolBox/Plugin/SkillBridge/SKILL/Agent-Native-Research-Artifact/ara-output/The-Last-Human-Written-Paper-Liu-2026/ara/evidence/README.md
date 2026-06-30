# Evidence Index — Liu et al. (2026)

## Key Result Tables

| ID | Type | Description | Source |
|----|------|-------------|--------|
| T03 | Table | Understanding evaluation: per-category accuracy and token usage (450 paired QA) | Table 3, §7.2 |
| T04 | Table | Rigor Auditor mutation benchmark: per-type detection rates (115 injections) | Table 4, §7.5 |
| T05 | Table | Dimensional coverage comparison: PDF vs. GitHub vs. Tracker vs. ARA | Table 5, §8 |
| T06 | Table | Information gap type distribution (8,921 requirements) | Table 9, §E.2 |
| T07 | Table | Per-paper reproduction success rates (15 papers, 3 difficulty strata) | Table 11, §F.2 |
| T08 | Table | RE-Bench task cards (5 tasks × score/ref/hardware) | Table 12, §G.1 |
| T14t | Table | Per-paper × per-injection detection for Level 2 mutation benchmark | Table 14, §H.2.2 |

## Key Figures

| ID | Type | Description | Source |
|----|------|-------------|--------|
| T09 | Figure | Storytelling Tax visual (branching tree → linear narrative) | Fig. 2, §1 |
| T10 | Figure | Engineering Tax visual (PaperBench gap breakdown) | Fig. 3, §1 |
| T11 | Figure | ARA directory structure | Fig. 4, §2 |
| T12 | Figure | Cross-layer structure of a real ARA | Fig. 5, §2 |
| T13 | Figure | Live Research Manager pipeline | Fig. 6, §3 |
| T14f | Figure | ARA Compiler pipeline | Fig. 7, §4 |
| T15 | Figure | Three-level ARA Seal | Fig. 8, §5 |
| T16 | Figure | Three-stage review pipeline | Fig. 9, §5 |
| T17 | Figure | (Human+AI)^2 network | Fig. 10, §6 |
| T18 | Figure | Aggregate reproduction success rates by difficulty | Fig. 11, §7.3 |
| T19 | Figure | Extension trajectories (5 RE-Bench tasks, Sonnet 4.6) | Fig. 12, §7.4 |
| T20 | Figure | Per-paper ARA-baseline delta heatmap | Fig. 13, §F.2 |
| T21 | Figure | triton_cumsum extension trajectory on Sonnet 4.5 | Fig. 14, §G.6.1 |
| T22 | Figure | restricted_mlm extension trajectory on Sonnet 4.5 | Fig. 15, §G.6.5 |

## Self-Referential Artifact (§A.3)

This paper itself is maintained as an ARA artifact. Key examples from its own `ara/` directory:

| ID | Type | Description | Source |
|----|------|-------------|--------|
| T25 | Manifest | Root PAPER.md with YAML frontmatter and Layer Index | §A.3.1 |
| T26 | Claim | Example claims C04 (Universal Ingestor) and C06 (Negative knowledge) | §A.3.2 |
| T27 | Heuristic | H04 (Directional verification) and H12 (Minimal kernel) | §A.3.4 |
| T28 | Trace | Nodes N04 (decision), N50 (dead_end), N17 (experiment) | §A.3.5 |
| T29 | Session | Session 2026-03-19_001 (BAM reproduction pilot) | §A.3.6 |
| T30 | Index | Session index excerpt (36 sessions chronology) | §A.3.6 |

## Cross-Layer Bindings
- T03 → C04, C12 (E03)
- T04 → C09, C10 (E09)
- T06 → C02, C14 (E02)
- T07 → C05 (E04)
- T19 → C06 (E05)
- T21, T22 → C06 (E05, weaker model inverts extension result)
- T25-T30 → C03, C07, C08 (self-referential demonstration)
- Fig. 2,3 → C01, C02 (E01, E02)
- Fig. 4,5 → C03
- Fig. 6 → C08 (E07)
- Fig. 7 → C07 (E06)
- Fig. 8,9 → C09 (E08, E09)

## Notes
- This paper defines the ARA protocol. All tables/figures are from the source PDF.
- PNG screenshots not available (environment limitation).
- The paper's own `ara/` (§A.3) contains 36 sessions, 16 claims, 18 heuristics, 94 exploration nodes.
- T21/T22 (Fig 14-15): Sonnet 4.5 trajectories showing trace value scales inversely with agent capability.
- T14t (Table 14): per-paper detection heatmap revealing orphan-experiment blind spot.