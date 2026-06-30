# Environment

## Publication Context
- **arXiv preprint**: arXiv:2604.24658v3, submitted 26 Apr 2026, revised 19 May 2026
- **Authors**: 38 authors from 20+ institutions (UMich, Stanford, OSU, MIT, Yale, Meta, UChicago, CMU, UW, UToronto, NVIDIA, NYU, NTU, Orchestra Research, Harvard, LinkedIn, UIUC, ASU, Stony Brook, HKU, BC, PSU, NUS, Cornell)
- **Lead institution**: University of Michigan
- **Corresponding author**: Jiachen Liu (amberljc@umich.edu)
- **Code**: github.com/AmberLJC/Agent-Native-Research-Artifact
- **Article type**: Research infrastructure / position paper with empirical evaluation
- **Pages**: ~46 pages (11 main + 35 appendix)
- **Figures**: 12 main + ~15 appendix figures
- **Acknowledgments**: The original manuscript was written by all authors; ChatGPT-5 was subsequently used in all sections to reformulate and condense the text.
- **ARA Commons**: This paper is part of the ARA Commons initiative.

## Key Datasets Used
- **PaperBench** (Starace et al., 2025): 23 ICML 2024 papers with expert-authored reproduction rubrics (8,921 requirements)
- **RE-Bench** (Wijk et al., 2025): 7 R&D tasks with continuous scoring; METR MALT transcripts (24,008 agent runs, 46,303 failure episodes)
- **METR eval-analysis-public dataset**: 24,008 agent runs, 21 frontier models, 228 tasks

## Models Used in Evaluation
- **Claude Sonnet 4.6** (Anthropic): Primary agent for understanding, reproduction, and extension experiments
- **Claude Opus 4.6** (Anthropic): Blinded judge for grading answers and rubric requirements
- **Claude Sonnet 4.5** (Anthropic): Comparison runs in extension experiment
- **GPT-3.5-turbo-1106** (OpenAI): Code generation in rust_codecontests task
- **Llama-3-8B-Instruct**: Judge model for nanogpt_chat_rl task

## Software / Tools
- **ARA Compiler**: Custom agent skill (§4, §B)
- **Live Research Manager**: Custom agent skill (§3, §C)
- **Rigor Auditor**: Custom agent skill (§5.2, §H.2.2)
- **Claude Agent SDK** (Anthropic, 2025b): Harness for extension experiments
- **SLURM**: Job scheduling (8h wall clock per extension run)
- **LightGBM**: Not used in this paper (used in Maier et al. 2025)

## Hardware
- **1× H100 GPU**: triton_cumsum, fix_embedding, nanogpt_chat_rl
- **2× H100 80 GB**: restricted_mlm
- **CPU-only**: rust_codecontests

## Code Availability
- Full code: github.com/AmberLJC/Agent-Native-Research-Artifact
- Includes: compiler skill specification, Live PM skill specification, Rigor Auditor skill specification, extension evaluation harness, analysis scripts
- The paper itself is maintained as an ARA: the `ara/` directory contains the living cognitive, physical, and exploration layers