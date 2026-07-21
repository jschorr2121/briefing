# 🧬 Protein Structure Prediction — Your Briefing

*Generated July 17, 2026 · Topic: "protein structure prediction" (deep-science niche) · Method: agentic gather → rank → grounded write*

**The gist:** Fold-prediction accuracy is saturating, so the 2026 race has moved to three new fronts: openness and scale (CZI Biohub's fully-open ESMFold2 vs. AlphaFold3's licensing), design and drug-binding (RFdiffusion3, Isomorphic's IsoDDE), and conformational ensembles over single static structures. The stubborn open problem, per CASP16, is still complexes — antibody–antigen especially.

---

## 1. CZI Biohub releases ESMFold2 and a 1.1-billion-structure open atlas

- The Chan Zuckerberg Initiative Biohub — which absorbed the EvolutionaryScale team after a Nov 2025 acquisition — released ESMFold2 and an expanded ESM Atlas around May 27, 2026: 6.8 billion sequences and ~1.1 billion predicted structures.
- That's roughly 800M more entries than the AlphaFold DB and ~300M more than the prior ESM Atlas, reported to match or beat AlphaFold3 on several benchmarks.
- The differentiator is licensing: it's fully open-source with no commercial-use restriction, unlike AF3.

*Sources: [Scientific American](https://www.scientificamerican.com/article/new-protein-folding-ai-vastly-expands-on-alphafolds-efforts/), [Lab Manager](https://www.labmanager.com/how-a-new-protein-folding-ai-generates-over-one-billion-structures-for-research-35487), [Biohub](https://biohub.org/news/world-model-of-protein-biology/) · May 27, 2026*

## 2. Isomorphic Labs raises $2.1B, targets first AI-designed drugs in the clinic this year

- Isomorphic closed a $2.1B Series B (announced May 13, 2026) — the largest AI-drug-discovery raise to date — positioning itself as biology-model infrastructure rather than a single-pipeline company.
- It follows February's unveiling of IsoDDE, the Isomorphic Drug Design Engine, reported to roughly double AF3's performance on a protein–ligand generalization benchmark.
- Demis Hassabis reiterated the goal of first AI-designed candidates (oncology/immunology) entering Phase I by end of 2026.

*Sources: [Forbes](https://www.forbes.com/sites/amyfeldman/2026/05/13/isomorphic-labs-21-billion-fundraise-is-the-biggest-bet-yet-on-ai-drug-discovery/), [Isomorphic Labs](https://www.isomorphiclabs.com/articles/the-isomorphic-labs-drug-design-engine-unlocks-a-new-frontier) · May 13, 2026*

## 3. Baker Lab's RFdiffusion3 is the current state of the art on the design side

- The IPD's RFdiffusion3 (Dec 3, 2025) runs ~10x faster than RFdiffusion2 and moves to atom-level design units, improving DNA-binding proteins and enzymes.
- It consolidates symmetric, binder, and catalytic design into a single model, and releases both weights and training code via the Rosetta Commons Foundry.
- Slightly older than the news window but still the reference release for protein design — carried for readers who missed it.

*Sources: [Institute for Protein Design](https://www.ipd.uw.edu/2025/12/rfdiffusion3-now-available/), [GeekWire](https://www.geekwire.com/2025/uw-nobel-winners-lab-releases-most-powerful-protein-design-tool-yet/) · Dec 3, 2025*

## 4. CASP16 assessments in print: monomers solved, complexes still hard

- The formal CASP16 assessments (Proteins / bioRxiv) find single-domain monomer folding effectively solved — no target folds mispredicted across evaluation units — with more groups now beating ColabFold thanks to AF3 adoption and heavy sampling.
- Complexes remain unsolved: over 30% of targets were hard, and antibody–antigen cases especially so (groups solved only about a quarter).
- Useful framing for calibrating expectations on the newer models above.

*Sources: [CASP16 monomer assessment (bioRxiv)](https://www.biorxiv.org/content/10.1101/2025.05.29.656942v1.full), [CASP16 complex assessment (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12154902/) · 2026*

## 5. The 2026 preprint theme: single-sequence speed and conformational dynamics

- TDFold (2D geometric template diffusion, now in Nature Machine Intelligence) does single-sequence prediction 10–100x faster than ESMFold/AF2/AF3 on long sequences.
- PathDiffusion (Jan 2026) mines 52M AlphaFold-DB structures with evolution-guided diffusion to model folding pathways, not just endpoints.
- Distance-restraint-guided diffusion (Jan 2026) extends AF3-style frameworks to predict specified conformational states — part of a clear shift from static single structures toward ensembles.

*Sources: [TDFold (bioRxiv)](https://www.biorxiv.org/content/10.1101/2025.07.03.662909v2), [PathDiffusion (bioRxiv)](https://www.biorxiv.org/content/10.64898/2026.01.16.699856v1), [Distance-restraint diffusion (bioRxiv)](https://www.biorxiv.org/content/10.64898/2026.01.30.702714v1) · Jan–Jul 2026*

---

**Worth a click**
- 🧪 [TDFold in Nature Machine Intelligence](https://www.nature.com/articles/s42256-026-01210-2) — the peer-reviewed version of the fast single-sequence method
- 🗂️ [AlphaFold DB adds homodimer/complex predictions](https://www.nature.com/articles/d41586-026-00787-3) — Nature news (paywalled; headline-grounded)

*Every link above is a real page returned by search/fetch during generation. Two Nature news pages (item 1's Nature link and the AlphaFold-DB homodimer story) redirect to an auth wall, so those claims are grounded via corroborating open sources rather than the Nature page itself — flagged in place. No facts were included that don't appear in a cited source.*
