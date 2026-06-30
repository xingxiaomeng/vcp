# Related Work

## Machine-Readable Research Artifacts
- **FAIR Principles (Wilkinson et al., 2016)**: Standardize data metadata but say nothing about argument structure. [LIMITED BY] G03.
- **W3C PROV Ontology (Lebo et al., 2013)**: Formalizes provenance for scientific outputs. [BACKGROUND].
- **Nanopublications (Groth et al., 2010)**: Atomize claims with provenance but lack execution semantics. [LIMITED BY] G03.
- **RO-Crate (Soiland-Reyes et al., 2022)**: Packages research artifacts as archival bundles, not executable objects. [LIMITED BY] G03.
- **Whole Tale (Brinckman et al., 2019)**: Packages computational environments. [BACKGROUND].
- **Open Research Knowledge Graph (Jaradeh et al., 2019)**: Curates structured contributions across papers. [BACKGROUND].
- **Discovery Engine (Baulin et al., 2025)**: Distills publications into a Conceptual Tensor. [BACKGROUND].
- **Canini (2026)**: Reframes paper as "compression format for human readers." [CONVERGENT] with ARA philosophy.
- **Stocker et al. (2025); Booeshaghi et al. (2026)**: Advocate authoring-time machine readability. [CONVERGENT].

## Reproducibility Infrastructure
- **Reproducibility crisis (Baker, 2016; Pineau et al., 2021)**: Motivation for code-sharing and workflow standards. [BACKGROUND].
- **Code-sharing standards (Stodden et al., 2016)**: Mandate code availability. [LIMITED BY] — code alone doesn't close the specification gap.
- **Workflow engines (Snakemake, Köster & Rahmann, 2012; Nextflow, Di Tommaso et al., 2017; CWL, Crusoe et al., 2022)**: Encode pipelines without claim semantics. [LIMITED BY] G03.
- **Computational notebooks (Knuth, 1984; Rule et al., 2018)**: Remain documents with hidden state. [LIMITED BY].
- **PaperBench (Starace et al., 2025)**: Benchmark showing frontier agents cannot recover knowledge PDFs leave implicit. [SUPPORTS] O03, O04.
- **EXP-Bench (Kon et al., 2025)**: Reports only 0.5% end-to-end experiment success. [SUPPORTS] O04.
- **SciCoQA (Baumgärtner & Gurevych, 2026)**: LLMs detect < 46% of paper-code discrepancies. [SUPPORTS].
- **Claim verification (Wadden et al., 2020; Gao et al., 2023; Huang, 2025; Rasheed et al., 2026)**: Prior auditing proposals address single dimensions. [LIMITED BY] — ARA's Seal operationalizes all dimensions.

## Negative Knowledge and Failed Trajectories
- **Zhu et al. (2025); Zhang et al. (2025)**: Failure traces become actionable only with root-cause annotation. [SUPPORTS] ARA's structured dead_end nodes.
- **HPO-B (Pineda Arango et al., 2021), NAS-Bench (Ying et al., 2019), AutoML benchmark (Gijsbers et al., 2019)**: Retain >99.99% more search history than papers report. [SUPPORTS] O02.
- **METR MALT (Wijk et al., 2025)**: Confirms extensive dead-end exploration by both humans and agents. [FOUNDATION] for E01.
- **AI Scientist (Lu et al., 2024; Yamada et al., 2025)**: Unstructured trajectory logs discarded once paper is written. [LIMITED BY] — same Storytelling Tax.

## Agent-Oriented Documentation
- **AGENTS.md (OpenAI, 2025)**: Standardizes agent-oriented docs for code repos but not epistemic structure. [LIMITED BY] G03.
- **ResearchCodeBench (Hua et al., 2025)**: LLMs implement < 40% of novel research contributions correctly. [SUPPORTS] O04.
- **Semantic Scholar (Lo et al., 2020), OpenAlex (Priem et al., 2022)**: Flat corpora, not structured artifacts. [BACKGROUND].
- **Paper2Code (Seo et al., 2025)**: Converts papers to executable code post-hoc. [CONVERGENT].
- **Paper2Agent (Miao et al., 2025)**: Converts papers to interactive AI agents. [CONVERGENT].
- **Tacit knowledge recovery (Li et al., 2026)**: Recovers undocumented knowledge via graph analysis. [SUPPORTS].
- **SWE-bench (Jimenez et al., 2024)**, **ScienceAgentBench (Chen et al., 2025)**: Agents fail on code tasks due to semantic misalignment. [SUPPORTS] O04.
- **Voyager (Wang et al., 2023)**: Skill-library standard for agents. [BACKGROUND].
- **Agent Skills (Anthropic, 2025a)**: Open specification for agent capabilities. [FOUNDATION] for Compiler and Live Manager implementations.
- **AutoGen (Wu et al., 2024)**: Multi-agent frameworks. [BACKGROUND].
- **Artifact-mediated agent coordination (Wang et al., 2026)**: Structured artifacts as unit of exchange. [CONVERGENT].

## Table comparing ARA with existing tools

| Dimension | PDF | GitHub | Tracker | ARA |
|-----------|-----|--------|---------|-----|
| Structured scientific logic | ∼ | ∼ | × | ✓ |
| Executable code | × | ✓ | × | ✓ |
| Exploration trajectory | × | × | ∼ | ✓ |
| Grounded evidence | ∼ | × | ∼ | ✓ |
| Cross-layer bindings | × | × | × | ✓ |