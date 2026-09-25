# Biology and taxonomy sources

Checked for the MVP species list and key ecological assumptions.

## Plants

### Fittonia albivenis
- Royal Botanic Gardens, Kew — Plants of the World Online: accepted species; native to southern tropical America; wet tropical biome.
  https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:105033-2
- NC State Extension Plant Toolbox: low-growing creeping tropical plant; terrarium suitability.
  https://plants.ces.ncsu.edu/plants/fittonia-albivenis/
- Hao et al. (2025), Plant, Cell & Environment: direct physiological/photosynthetic study of *F. albivenis* under prolonged far-red/high-light treatments; includes photosynthetic light-response supporting information. This supports shade/light-response model structure but does not by itself supply every Phase-2 growth coefficient.
  DOI: https://doi.org/10.1111/pce.70113
  PMID: https://pubmed.ncbi.nlm.nih.gov/40793932/
- Nature Communications (2024), structure of red-shifted *F. albivenis* photosystem I. Methods report a documented chamber condition of 23 C, 20 umol photons m^-2 s^-1 and 16 h light / 8 h dark before leaf harvest. This is an experimental condition, not evidence of a species optimum.
  https://www.nature.com/articles/s41467-024-50655-9

### Peperomia caperata
- Royal Botanic Gardens, Kew — Plants of the World Online: accepted species; native to southeastern Brazil; wet tropical biome.
  https://powo.science.kew.org/taxon/678190-1
- NC State Extension: medium/filtered light is suitable; soil should be moist but well drained and the species does not tolerate persistently wet or very dry soil. Supports the water-stress model direction, not an exact transpiration coefficient.
  https://plants.ces.ncsu.edu/plants/peperomia-caperata/
- Shin, Lee & Nam (2023): controlled LED experiment on *P. caperata* cultivars. Plants were grown for five weeks at 20 ± 1 C, about 63.7 ± 15.2% RH, 14 h photoperiod, and PPFD 100 µmol m^-2 s^-1. This provides a documented growth condition, not a universal optimum.
  https://doi.org/10.22698/jales.20230025

### Pilea depressa
- Royal Botanic Gardens, Kew — Plants of the World Online: accepted species; native Cuba to Hispaniola; wet tropical biome.
  https://powo.science.kew.org/taxon/855364-1
- Penn State Extension, Pilea houseplant guidance: Pilea are low-growing tropical/subtropical plants suited to bright indirect light and warm conditions; typical daytime indoor temperatures of about 65–75 F are described. This is genus-level horticultural evidence and is therefore treated as low-confidence proxy data for *P. depressa* coefficients.
  https://extension.psu.edu/pilea-as-a-houseplant

## Invertebrates

### Folsomia candida
- OECD Test Guideline 232: standard parthenogenetic soil collembolan used for reproduction tests.
  https://www.oecd.org/en/publications/test-no-232-collembolan-reproduction-test-in-soil_9789264264601-en.html
- Fountain & Hopkin, Annual Review of Entomology (2005): widespread soil arthropod; parthenogenetic; standard research organism.
  https://pubmed.ncbi.nlm.nih.gov/15355236/

### Trichorhina tomentosa
- GBIF/accepted taxonomic sources should be used in implementation data.
- Supporting overview: real dwarf white isopod species; tropical, moisture-dependent detritivore; parthenogenetic populations are widely reported.
  https://www.gbif.org/species/search?q=Trichorhina%20tomentosa

### Bradysia impatiens
- University of Florida IFAS: biology of dark-winged fungus gnats; larvae feed on fungi and can feed on roots; life-cycle data.
  https://ask.ifas.ufl.edu/publication/IN372
- UC IPM: fungus-gnat larvae feed on roots/algae; predators include Dalotia.
  https://ipm.ucanr.edu/agriculture/floriculture-and-ornamental-nurseries/fungus-gnats/

### Dalotia coriaria
- ITIS: valid current name *Dalotia coriaria*; *Atheta coriaria* is a synonym.
  https://itis.gov/servlet/SingleRpt/SingleRpt?search_topic=TSN&search_value=724970
- Cornell Greenhouse Horticulture: *D. coriaria* is a soil-dwelling generalist predator of fungus-gnat larvae and other small prey.
  https://greenhouse.cornell.edu/pests-diseases/guidelines/cornell-pesticide-guidelines-supplemental-information-insects/
- Echegaray & Cloyd (2013): laboratory life-history data. At 26 C, mean egg, larval and pupal durations were about 2.2, 7.1 and 7.8 days; egg-to-adult about 17 days.
  https://krex.k-state.edu/items/2dc98502-3568-438d-be26-df58cae2652b

## Microbes

### Linnemannia elongata
- Index Fungorum: current name *Linnemannia elongata*; basionym/synonym *Mortierella elongata*.
  https://www.indexfungorum.org/names/NamesRecord.asp?RecordID=833768
- University of Florida IFAS: widespread soil fungus, saprotrophic and root-associated; reports culture growth well at roughly 20–25 C and use of simple carbon sources, with ecological roles including soil carbon/nutrient cycling.
  https://ask.ifas.ufl.edu/publication/SS679
- Bajpai et al. (1992): *Mortierella elongata* NRRL 5513 reached stationary mycelial growth at about 48 h when cultured at 25 C in the study medium. Culture kinetics are useful constraints but are not direct terrarium decomposition rates.
  https://doi.org/10.1007/BF01569606

### Bacillus subtilis
- Soil/ecology literature supports *B. subtilis* as a common soil bacterium and an organism associated with organic matter particles. The MVP uses it as an explicit bacterial decomposer proxy, not as a claim that one bacterial species represents the full soil microbiome.
  https://www.microbiologyresearch.org/content/journal/micro/10.1099/00221287-81-1-183
- Wita et al. (2019): one environmental *B. subtilis* isolate showed high cellulolytic activity, with maximum activity reported at 32 C in that experiment. This is strain-/assay-specific and is not treated as a universal species optimum.
  https://doi.org/10.21307/pjm-2019-012
  PMID: https://pubmed.ncbi.nlm.nih.gov/31050258/
- Pold et al. (2020): soil-bacterial carbon-use efficiency varies substantially with taxon, substrate and temperature. Simarium uses this only as a proxy constraint for an initial coarse decomposer CUE and labels the value ASSUMED, not *B. subtilis*-measured.
  https://doi.org/10.1128/mBio.02293-19
  PMID: https://pubmed.ncbi.nlm.nih.gov/31964725/

## Modeling notes

1. The species roster is biologically real, but it is a constructed bioactive terrarium rather than a strict one-location natural community.
2. Exact parameter values must be stored with provenance and calibrated against literature ranges.
3. If later versions claim a geographic biotope (for example, Amazonian understory), every species must be replaced/verified for sympatry and local habitat compatibility.
4. User-facing common names are secondary. Scientific names are canonical IDs for biological content.
