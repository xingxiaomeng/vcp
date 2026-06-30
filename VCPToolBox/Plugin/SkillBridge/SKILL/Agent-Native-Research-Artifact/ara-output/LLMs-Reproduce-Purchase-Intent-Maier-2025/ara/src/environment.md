# Environment

## Publication Context
- **arXiv preprint**: arXiv:2510.08338v3, received 28 Oct 2025
- **Authors**: Benjamin F. Maier, Ulf Aslak, Luca Fiaschi, Nina Rismal, Kemble Fletcher, Christian C. Luhmann (PyMC Labs) + Robbie Dow, Kli Pappas (Colgate-Palmolive) + Thomas V. Wiecki (PyMC Labs)
- **Affiliations**: PyMC Labs (Amsterdam/Berlin) and Colgate-Palmolive Company (New York)
- **Article type**: Empirical research paper with methodological contribution
- **Pages**: 11 pages main text + extensive appendix (~40 pages total including figures)

## Data
- 57 consumer research surveys on personal care product concepts
- Source: Leading personal care corporation (Colgate-Palmolive)
- 9,300 unique US participants (150-400 per survey)
- Platform: Digital consumer research platform (unnamed)
- Demographics: age, gender, location (most surveys); income, ethnicity (fewer surveys)
- Response: 5pt Likert purchase intent

## Models Used
- **GPT-4o** (OpenAI): Primary experiments
- **Gemini-2.0-flash (Gem-2f)** (Google): Replication
- **text-embedding-3-small** (OpenAI): Embedding model for SSR
- (Initial tests also with gemini-1.5-flash, gemini-2.5, o3)

## Code Availability
- SSR implementation: https://github.com/pymc-labs/semantic-similarity-rating
- Full Python implementation provided in Appendix C.2

## Software
- LightGBM (Ke et al., 2017) for ML baseline
- Python (assumed, based on ecosystem)

## Hardware
- Not specified (cloud API usage for LLM inference)