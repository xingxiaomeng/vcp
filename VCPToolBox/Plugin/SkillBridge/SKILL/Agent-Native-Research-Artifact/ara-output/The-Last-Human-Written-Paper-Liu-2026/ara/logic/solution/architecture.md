# Architecture: The ARA Protocol

## Overview

ARA organizes a research contribution into four interlocking layers within a file-system ontology:

```
ara/
  PAPER.md                      # Root manifest + layer index (~500 tokens for triage)
  logic/                        # Cognitive Layer: structured scientific reasoning
    problem.md                  #   Observations, gaps, key insight, assumptions
    claims.md                   #   Falsifiable assertions with proof pointers
    concepts.md                 #   Formal definitions
    experiments.md              #   Declarative verification plans
    related_work.md             #   Typed citation dependency graph
    solution/                   #   Architecture, algorithm, constraints, heuristics
      architecture.md           #     This file
      algorithm.md              #     Core algorithm specifications
      constraints.md            #     Limitations and assumptions
      heuristics.md             #     Design decisions with rationale and sensitivity
  src/                          # Physical Layer: executable code
    environment.md              #   Dependencies, hardware, seeds
    kernel/ or repo/            #   Kernel mode or repository mode (declared in PAPER.md)
    configs/                    #   Annotated hyperparameters with rationale and search range
  trace/                        # Exploration Graph: branching research trajectory
    exploration_tree.yaml       #   Nested YAML DAG (question/decision/experiment/dead_end/pivot)
    sessions/                   #   Per-session records
    pm_reasoning_log.yaml       #   Live PM's own reasoning trace
  evidence/                     # Evidence Layer: raw empirical outputs
    README.md
    tables/                     #   Machine-readable metric tables
    figures/                    #   Figure descriptions
    logs/                       #   Training curves, resource usage
  staging/                      # Buffer for unpromoted observations
    observations.yaml
```

## Cross-Layer Bindings

Forensic bindings connect all four layers via explicit references:
- **Claim → Evidence**: claims.md Proof → experiments.md → evidence/tables/
- **Claim → Code**: claims.md → heuristic.md Code ref → src/kernel/
- **Experiment → Claim**: experiments.md Verifies → claims.md
- **Evidence → Trace**: exploration_tree.yaml evidence: → claim IDs

## Design Principle

*Knowledge over Narrative* — the organized, evolving knowledge produced during research is the primary scientific object; the narrative paper is a compiled view.

## Four-Layer Design Rationale

| Layer | Question it answers | Type of content | Mutability |
|-------|-------------------|-----------------|------------|
| **Cognitive (/logic)** | Why does this work? | Stable, citable reasoning units | Mutable (current best understanding) |
| **Physical (/src)** | How is it implemented? | Executable code | Iterates continuously |
| **Exploration (/trace)** | What was tried along the way? | Branching decision history | Append-only (the journey record) |
| **Evidence (/evidence)** | What are the numbers? | Machine-precise values | Append-only (raw outputs) |

## Kernel Mode vs. Repository Mode

- **Kernel mode** (src/kernel/): For algorithmic contributions. Contains only core modules with typed I/O signatures, 1–2 OOM smaller than full repo. Agent generates fresh boilerplate. Mode chosen when the contribution is primarily algorithmic.
- **Repository mode** (src/repo/): For systemic contributions (CUDA kernels, distributed training, systems architecture). Full implementation retained with index.md manifest; forensic bindings connect code regions to claims and heuristics.
- **Declaration**: mode specified in PAPER.md frontmatter via `src_mode: kernel|repo`.

## ARA Sufficiency Criterion

An ARA is sufficient when a sufficiently capable coding agent can reproduce the core claim zero-shot from it, without human intervention or external context beyond the artifact itself. This is a capability-relative criterion — artifacts remain valid as agents advance.