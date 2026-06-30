---
title: "The Last Human-Written Paper: Agent-Native Research Artifacts"
authors:
  - "Jiachen Liu"
  - "Jiaxin Pei"
  - "Jintao Huang"
  - "Chenglei Si"
  - "Ao Qu"
  - "Xiangru Tang"
  - "Runyu Lu"
  - "Lichang Chen"
  - "Xiaoyan Bai"
  - "Haizhong Zheng"
  - "Carl Chen"
  - "Zhiyang Chen"
  - "Haojie Ye"
  - "Yujuan Fu"
  - "Zexue He"
  - "Zijian Jin"
  - "Zhenyu Zhang"
  - "Shangquan Sun"
  - "Maestro Harmon"
  - "Dianzhuo Wang"
  - "Qian-ze Zhu"
  - "Jianqiao Zeng"
  - "Jiachen Sun"
  - "Mingyuan Wu"
  - "Baoyu Zhou"
  - "Chenyu You"
  - "Shijian Lu"
  - "Yiming Qiu"
  - "Fan Lai"
  - "Yuan Yuan"
  - "Yao Li"
  - "Junyuan Hong"
  - "Ruihao Zhu"
  - "Beidi Chen"
  - "Alex Pentland"
  - "Ang Chen"
  - "Mosharaf Chowdhury"
  - "Zechen Zhang"
year: 2026
venue: "arXiv preprint (arXiv:2604.24658v3)"
doi: "arXiv:2604.24658v3"
ara_version: "1.1.0"
domain: "cs.LG / AI infrastructure / scientific communication"
keywords:
  - agent-native research artifact
  - ARA
  - reproducibility
  - research infrastructure
  - storytelling tax
  - engineering tax
  - exploration graph
  - live research manager
  - ARA compiler
  - ARA seal
claims_summary: |
  ARA is a protocol that recasts the primary research object from narrative document to agent-executable knowledge package organized into four interlocking layers: Cognitive (/logic), Physical (/src), Exploration Graph (/trace), and Evidence (/evidence). Three mechanisms support the ecosystem: Live Research Manager, ARA Compiler, and ARA-Native Review System (Seal Levels 1-3). On PaperBench and RE-Bench, ARA raises QA accuracy from 72.4% to 93.7%, reproduction success from 57.4% to 64.4%. On RE-Bench extension tasks, preserved failure traces accelerate progress but can also constrain capable agents.
abstract: |
  Scientific publication compresses a branching, iterative research process into a linear narrative, discarding the majority of what was discovered along the way. This compilation imposes two structural costs: a Storytelling Tax, where failed experiments, rejected hypotheses, and the branching exploration process are discarded to fit a linear narrative; and an Engineering Tax, where the gap between reviewer-sufficient prose and agent-sufficient specification leaves critical implementation details unwritten. Tolerable for human readers, these costs become critical when AI agents must understand, reproduce, and extend published work. We introduce the Agent-Native Research Artifact (ARA), a protocol that replaces the narrative paper with an agent-executable research package structured around four layers: scientific logic, executable code with full specifications, an exploration graph that preserves the failures compilation discards, and evidence grounding every claim in raw outputs. Three mechanisms support the ecosystem: a Live Research Manager that captures decisions and dead ends during ordinary development; an ARA Compiler that translates legacy PDFs and repos into ARAs; and an ARA-native review system that automates objective checks so human reviewers can focus on significance, novelty, and taste. On PaperBench and RE-Bench, ARA raises question-answering accuracy from 72.4% to 93.7% and reproduction success from 57.4% to 64.4%.

# Layer Index
- **logic/problem.md**: Research problem, observations, gaps, and key insight
- **logic/claims.md**: 16 falsifiable claims with status and proof pointers
- **logic/concepts.md**: Key conceptual definitions (Storytelling Tax, Engineering Tax, ARA, etc.)
- **logic/experiments.md**: Verification plan (E01-E10)
- **logic/solution/constraints.md**: Limitations and assumptions
- **logic/solution/architecture.md**: The four-layer ARA protocol architecture
- **logic/related_work.md**: Typed citation dependency graph
- **src/environment.md**: Paper context and code availability
- **trace/exploration_tree.yaml**: 114-node research DAG
- **evidence/README.md**: Index of evaluation results
- **evidence/tables/**: Key result tables (Table 3, 4, 5, etc.)
- **evidence/figures/**: Figure descriptions