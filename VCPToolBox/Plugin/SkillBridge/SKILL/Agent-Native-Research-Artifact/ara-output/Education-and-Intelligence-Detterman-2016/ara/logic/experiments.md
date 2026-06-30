# Experiments

## E01: Coleman Report (1966)
- **Verifies**: [C01, C02]
- **Setup**: Congressionally mandated study of American schools; data from 4,000 public schools and >645,000 students in grades 1, 3, 6, 9, and 12. Collected surveys, ability tests, and achievement tests from school principals, teachers, and students.
- **Procedure**: Multivariate analysis decomposing variance in academic achievement into school-associated and student-associated components.
- **Metrics**: Proportion of total variance in academic achievement attributable to schools vs. students.
- **Expected outcome**: Researchers expected to find large school effects. Instead found 10%–20% of variance attributable to schools, 80%–90% to student characteristics. Teacher quality accounted for ~1% of total variance. Critically, **the proportion of variance attributable to schools decreased in later grades**.
- **Baselines**: Not applicable (first large-scale study of its kind).
- **Dependencies**: [A01, A04]
- **Source**: Coleman et al. (1966)

## E02: Jencks et al. (1972) Reanalysis
- **Verifies**: [C01, C02]
- **Setup**: Extensive re-examination of Coleman report data plus other related data sources.
- **Procedure**: Reanalysis of variance decomposition across multiple datasets.
- **Metrics**: Proportion of variance attributable to students vs. schools.
- **Expected outcome**: Confirmed Coleman report conclusions — largest portion of variance due to students, not schools.
- **Baselines**: Coleman et al. (1966) findings.
- **Dependencies**: [E01]
- **Source**: Jencks et al. (1972)

## E03: Gamoran and Long (2006) + Heyneman-Loxley Studies
- **Verifies**: [C02, C05]
- **Setup**: Review of 40 years of research following Coleman report, including data from developing countries. Heyneman and Loxley (1983) initially found larger school effects in poorer countries. Baker, Goesling, and LeTendre (2002) re-examined this pattern.
- **Procedure**: Cross-national comparison of variance decomposition by country income level.
- **Metrics**: Proportion of variance attributable to schools vs. students, stratified by per capita income.
- **Expected outcome**: For countries with per capita income > $16,000, Coleman findings hold (schools account for small portion). For poorer countries, schools initially accounted for more variance, but this effect is diminishing as schooling availability increases. **Range of school effects in poor countries: 10%–40% — students still account for the majority even in the poorest schools.**
- **Dependencies**: [A04, A05]
- **Source**: Gamoran & Long (2006); Heyneman & Loxley (1983); Baker, Goesling, & LeTendre (2002)

## E04: Warsaw Natural Experiment (Firkowska et al., 1978)
- **Verifies**: [C01, C02]
- **Setup**: Post-WWII Warsaw residents were assigned to reconstructed districts nearly randomly. Firkowska et al. studied children born in 1963, obtaining Raven's Matrices tests and parents' education/occupation (13-point social class index).
- **Procedure**: Correlation analysis between child IQ and social class index; variance decomposition between schools.
- **Metrics**: r² between IQ and social class; between-school variance component.
- **Expected outcome**: Expected r² ≈ 0.00. Found r² = 0.97 (near-perfect). Between-school variance reduced from typical 10% to 2.1% — student variance accounted for ~98% of outcome.
- **Baselines**: Typical between-school variance (~10%) from Coleman-type studies.
- **Dependencies**: [A01]
- **Source**: Firkowska et al. (1978)

## E05: Angoff and Johnson (1990) — College/University Effects
- **Verifies**: [C01, C02]
- **Setup**: Students who took SAT then returned for GRE 4-5 years later. Selected 7,954 students from 292 institutions (avg. 27 per institution). Used math sections of both tests for maximum instructional sensitivity.
- **Procedure**: Regressed math SAT + major + gender onto GRE math scores.
- **Metrics**: Proportion of GRE math variance predicted by student characteristics vs. institution attended.
- **Expected outcome**: Found that student characteristics predicted 93% of GRE math variance; at most 7% could be attributed to institution attended.
- **Baselines**: Not applicable (single study design).
- **Dependencies**: [A01, A04]
- **Source**: Angoff & Johnson (1990)

## E06: Byrne et al. (2010) — Twin Study of Teacher Effects
- **Verifies**: [C01]
- **Setup**: Twin study comparing literacy achievement between twins placed in same vs. different classrooms.
- **Procedure**: Difference in correlation between same-classroom twins vs. different-classroom twins used to estimate teacher variance.
- **Metrics**: Proportion of achievement variance attributable to having different teachers.
- **Expected outcome**: Estimated that no more than 8% of achievement variance could be attributed to having different teachers.
- **Baselines**: Within-twin (MZ/DZ) correlation comparisons.
- **Dependencies**: [A04]
- **Source**: Byrne et al. (2010)

## E07: Chingos and Whitehurst (2014) — FL & NC Administrative Data
- **Verifies**: [C01, C02]
- **Setup**: Analyzed academic achievement data for Florida (grades 3-8) and North Carolina (grades 3-10) for 2000-01 through 2009-10. ~2.3 million data points per year, ~23 million total. Control variables: gender, race/ethnicity, disability status, gifted status, free/reduced lunch, limited English proficiency.
- **Procedure**: Variance decomposition estimating contributions of year, superintendent, district, school, teacher, controls, and student.
- **Metrics**: Percent of total variance in academic achievement attributed to each factor.
- **Expected outcome**: Teachers: 3.0% (NC data); total school factors: 9.2%; student factors: 90.8%. In Whitehurst, Chingos & Gallaher (2013), teachers accounted for 6.7% out of 9.6% total school variance.
- **Baselines**: Not applicable (descriptive decomposition).
- **Dependencies**: [A01, A04]
- **Source**: Chingos & Whitehurst (2014); Whitehurst, Chingos & Gallaher (2013)

## E08: Deary, Strand, Smith, and Fernandes (2007) — English Adolescents
- **Verifies**: [C03]
- **Setup**: Matched >70,000 English students' GCSE scores (age 15/16) with Cognitive Abilities Test (CAT) scores from age 11. Largest matched sample: 13,248 students who took same GCSE courses; replication sample: 12,519.
- **Procedure**: Extracted general factors from GCSE tests (achievement g) and CAT subtests (intelligence g); correlated them.
- **Metrics**: Correlation between intelligence g and achievement g; effect sizes (η²) for individual subjects.
- **Expected outcome**: r = 0.81 between g factors (intelligence predicts ~66% of achievement g variance). Effect sizes ranged from η² = 58.6% (Mathematics) to 18.1% (Art and Design).
- **Baselines**: Replication on second large sample showed "trivial" differences.
- **Dependencies**: [A03]
- **Source**: Deary et al. (2007)

## E09: Kaufman, Reynolds, Liu, Kaufman, and McGrew (2012)
- **Verifies**: [C03]
- **Setup**: Used Kaufman intelligence and achievement tests (n = 2,520) and Woodcock-Johnson tests (n = 4,969). Extracted hierarchical general factors for cognitive ability and academic achievement by age.
- **Procedure**: Correlated cognitive g and achievement g from detailed latent trait models.
- **Metrics**: Mean correlation between cognitive g and achievement g; correlation range by age.
- **Expected outcome**: Mean r = 0.83; range 0.77 to 0.94 (increasing with age — correlation between g factors **strengthens as children grow older**). Correlations were significantly different from 1.0, indicating intelligence does not perfectly predict achievement.
- **Baselines**: Cross-battery comparison (Kaufman vs. Woodcock-Johnson).
- **Dependencies**: [A03]
- **Source**: Kaufman et al. (2012)

## E10: Lynn and Mikk (2007) — National-Level IQ and TIMSS
- **Verifies**: [C03]
- **Setup**: Used 2003 TIMSS testing for grades 4 and 8 (math and science) and estimated national IQs.
- **Procedure**: Correlation between mean country IQ and TIMSS scores.
- **Metrics**: Correlation coefficients (raw and corrected for attenuation).
- **Expected outcome**: r = 0.85–0.93 (uncorrected); 0.92–1.00 (corrected for attenuation). Group-mean correlations expectedly higher than individual-level correlations.
- **Baselines**: Not applicable (ecological-level analysis).
- **Dependencies**: [A03]
- **Source**: Lynn & Mikk (2007)

## E11: Crano, Kenny, and Campbell (1972) — Cross-Lagged Panel
- **Verifies**: [C04]
- **Setup**: Large sample of ~4,000 students who took both achievement and intelligence tests in 4th grade and again in 6th grade.
- **Procedure**: Cross-lagged panel correlation analysis.
- **Metrics**: Cross-lagged correlations: intelligence (T1) → achievement (T2) vs. achievement (T1) → intelligence (T2).
- **Expected outcome**: Intelligence at T1 predicted achievement at T2. Achievement at T1 did not significantly predict intelligence at T2.
- **Baselines**: Not applicable (directional comparison).
- **Dependencies**: [A06]
- **Source**: Crano, Kenny, & Campbell (1972)

## E12: Watkins, Lei, and Canivez (2007) — Cross-Lagged Panel
- **Verifies**: [C04]
- **Setup**: Smaller sample (n = 289) tested an average of 2.8 years apart on WISC-III and a combination of achievement tests.
- **Procedure**: Formed latent variables for achievement and general intelligence; cross-lagged panel analysis.
- **Metrics**: Cross-lagged path coefficients between latent intelligence and latent achievement.
- **Expected outcome**: Replicated Crano et al. (1972) finding: intelligence → achievement path significant; achievement → intelligence path not significant.
- **Baselines**: Crano, Kenny, & Campbell (1972) findings.
- **Dependencies**: [A06]
- **Source**: Watkins, Lei, & Canivez (2007)

## E13: Mosing, Madison, Pederson, Kuja-Halkola, and Ullen (2014) — Swedish Twin Music Study
- **Verifies**: [C04] (supports causal asymmetry by analogy)
- **Setup**: 10,500 Swedish twins; music ability assessed for rhythm, melody, and pitch discrimination; practice hours recorded; intrapair differences up to 20,228 hours.
- **Procedure**: Intrapair-difference modeling controlling for all genetic and shared environmental factors.
- **Metrics**: Association between practice and ability within MZ twin pairs.
- **Expected outcome**: Practice showed heritability (40%–70%). Crucially, after controlling for genetics, the twin who practiced more did NOT have better music ability.
- **Baselines**: Between-family associations (confounded by genetics).
- **Dependencies**: [A06]
- **Source**: Mosing et al. (2014)

## E14: Krapohl et al. (2014) — GCSE and Student Characteristics
- **Verifies**: [C03, C06]
- **Setup**: >13,000 twins who took GCSE at ~16 years. Examined 9 student characteristics: intelligence, self-efficacy, school environment, home environment, personality, well-being, parent-reported behavior problems, child-reported behavior problems, health.
- **Procedure**: Phenotypic correlations, genetic correlations, and shared heritability analysis between each characteristic and GCSE.
- **Metrics**: Phenotypic r with GCSE; r between characteristic and intelligence; shared heritability with GCSE.
- **Expected outcome**: Intelligence alone predicts 34% of GCSE variance; the other 8 characteristics combined predict 28%; combined prediction: 45% (only 11% gain over intelligence alone). All characteristics plus intelligence account for 75% of heritability of GCSE.
- **Baselines**: Not applicable (descriptive decomposition).
- **Dependencies**: [A03]
- **Source**: Krapohl et al. (2014)

## E15: Engelhardt et al. (2015) — Executive Functions Genetics
- **Verifies**: [C06]
- **Setup**: Twin study examining heritability of executive function components (inhibition, switching, working memory, updating) in childhood.
- **Metrics**: Heritability estimates for executive function components.
- **Expected outcome**: Executive function components found to be highly heritable.
- **Baselines**: Not applicable.
- **Dependencies**: []
- **Source**: Engelhardt et al. (2015)

## E16: P-FIT Neuroscience Studies (Jung & Haier, 2007; Basten et al., 2015)
- **Verifies**: [C06]
- **Setup**: Quantitative meta-analyses of functional and structural brain imaging studies on intelligence.
- **Procedure**: Integration of neuroimaging evidence to identify brain regions consistently associated with intelligence.
- **Metrics**: Brain region involvement, network integration.
- **Expected outcome**: Parietal-Frontal Integration Theory (P-FIT) provides a neuroanatomical map of intelligence. Extended by Basten et al. (2015).
- **Baselines**: Earlier neuroimaging reviews.
- **Dependencies**: []
- **Source**: Jung & Haier (2007); Basten, Hilger, & Fiebach (2015)

## E17: Gender/Inequality Deductive Argument (Detterman theoretical)
- **Verifies**: [C04]
- **Setup**: Deductive/conceptual argument: In populations where men receive substantially more education than women, if achievement does not affect intelligence, men and women should score similarly on general intelligence tests but significantly different on academic achievement tests.
- **Procedure**: Logical deduction rather than empirical experiment. Proposed as a testable consequence, not a conducted study.
- **Metrics**: Comparison of male-female mean differences on intelligence tests vs. achievement tests in gender-unequal educational contexts.
- **Expected outcome**: Predicts similar IQ scores but divergent achievement scores between genders in contexts of unequal educational access.
- **Baselines**: Ceci (1991) — documented cases where negative environments reduce general intelligence.
- **Dependencies**: [A06]
- **Source**: Detterman (2016), p.7

## E18: Genetic Architecture Summary (Plomin et al., 2016; Haworth et al., 2010; Plomin & Kovas, 2005)
- **Verifies**: [C03, C06]
- **Setup**: Review of behavioral genetics findings on intelligence and academic achievement.
- **Procedure**: Synthesis of multiple large-scale twin and molecular genetic studies.
- **Metrics**: Heritability estimates, SNP contributions, pleiotropy patterns.
- **Expected outcome**: Individual genetic effects are small and numerous; heritability of g increases linearly from childhood to adulthood; effects are pleiotropic (same genes affect multiple traits); as sample sizes grow, SNPs account for increasingly larger portions of variance. Likely that no exclusive "intelligence genes" exist — only genes that affect intelligence.
- **Baselines**: Not applicable (review/synthesis).
- **Dependencies**: []
- **Source**: Plomin et al. (2016); Haworth et al. (2010); Plomin & Kovas (2005)