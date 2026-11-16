# Wrist-worn activity recognition for unseen users

**ES 335 course project** · Nityanand Karmali · Amartya Tuljapurkar

**Website:** https://nitya047.github.io/capture24-site/

Can simple models recognise sleep, sedentary, light and moderate-vigorous activity from 10-second
windows of wrist-accelerometer data, for people they have never seen? And how much does a compact
model (a shallow tree, few features) give up compared with a larger one (a random forest)?

**Answer in one line:** on 50 unseen people the random forest reaches macro-F1 **0.700**
(95% interval 0.673–0.726); a depth-5 decision tree reaches **0.673**, and the forest keeps almost
all of its accuracy with 8 of its 16 features (0.707 vs 0.713 on the feature-budget models).

## Repository contents

| Path | What it is |
|---|---|
| `notebooks/preprocessing.ipynb` | Notebook 1, as run on Kaggle with outputs: raw CAPTURE-24 CSV → one row per labelled 10 s window, 16 features, quality stats |
| `notebooks/modelling.ipynb` | Notebook 2, as run on Kaggle with outputs: split, leakage demo, tuning, single test evaluation, bootstrap intervals, feature budget, error audit, sensitivity check, learning curve |
| `results/` | Everything the modelling notebook exported, unchanged (see below) |
| `results/split.json` | The exact train/test participant lists, seed and CV scheme |
| `results/stats.csv` | Per-participant data-quality stats from notebook 1 (rows vs expected rows, identical samples, labelled windows) |
| `results/cv_results.csv` | Every hyperparameter setting tried, with CV and train macro-F1 |
| `results/test_results.csv` | Test metrics for the four final models |
| `results/*.json` | Full results, feature-budget curves (k = 1…16), leakage demo, learning curve, compact models, anonymised per-person results |
| `results/figures/` | All figures from the modelling notebook |
| `index.html`, `style.css`, `app.js`, `data/` | The website (plain HTML/CSS/JS, no build step). `data/` is a copy of the website's subset of `results/` (no participant IDs) |
| `import_results.sh` | Copies a new `results.zip` into `results/` and `data/` |

## Data access

The raw data is **not** in this repository (about 152 GB, and the licence asks users to get it from the source).

- **Dataset:** CAPTURE-24, Oxford Research Archive, DOI [10.5287/bodleian:NGx0JOMP5](https://doi.org/10.5287/bodleian:NGx0JOMP5), CC BY 4.0.
- **Copy we used:** the Kaggle mirror
  [kooaslansefat/capture-24-human-activity-recognition](https://www.kaggle.com/datasets/kooaslansefat/capture-24-human-activity-recognition).
  It contains one CSV per participant (`P001.csv` … `P151.csv`: `time, x, y, z, annotation`),
  `annotation-label-dictionary.csv` and `metadata.csv` (age group, sex).
- **Our preprocessed features (public):**
  [nityanandkarmali/capture24-features](https://www.kaggle.com/datasets/nityanandkarmali/capture24-features)
  holds `capture24_features.parquet` and `stats.csv` exactly as produced by our preprocessing
  notebook, so the modelling can be checked without rerunning preprocessing.
- You need a (free) Kaggle account to attach these to a notebook.

## How to reproduce

Both notebooks are public on Kaggle and run there with no setup:

- Preprocessing: https://www.kaggle.com/code/nityanandkarmali/preprocessing
- Modelling: https://www.kaggle.com/code/nityanandkarmali/modelling

**Shortcut (check the modelling only, about 1 hour):** open the modelling notebook → **Copy & Edit**.
It already uses our public features dataset as input
([capture24-features](https://www.kaggle.com/datasets/nityanandkarmali/capture24-features));
if it is not attached, use **Add Input** → search `capture24-features`. Then
**Save Version → Save & Run All**.

**Full reproduction from raw data**

1. **Preprocessing (about 1 hour, CPU only).** Open the preprocessing notebook → **Copy & Edit**.
   Check that the CAPTURE-24 Kaggle dataset is attached (**Add Input** → search
   `capture-24-human-activity-recognition`). Run **Save Version → Save & Run All**.
   It writes `capture24_features.parquet` (934,776 rows × 16 features + label, pid, age, sex) and
   `stats.csv` to the notebook's output.
2. **Modelling (about 1 hour, CPU only).** Open the modelling notebook → **Copy & Edit**.
   **Add Input → Your Work →** the output of your preprocessing run. The first cells find
   `capture24_features.parquet` and `stats.csv` wherever they are mounted. Run
   **Save Version → Save & Run All**. All randomness uses seed 42.
3. Download `results.zip` from the modelling notebook's **Output** tab. To refresh this repository and
   the website from it: `sh import_results.sh path/to/results.zip`.

**Running outside Kaggle:** install Python 3.11+ with
`pip install numpy pandas scikit-learn matplotlib pyarrow`, download the dataset, and change the
`ROOT` path in the first code cell of the preprocessing notebook and the input paths in the modelling
notebook. The versions used for the reported results were Python 3.13, numpy 2.1.3, pandas 2.3.3 and
scikit-learn 1.6.1 (printed in the modelling notebook, Section 1).

**Preview the website locally:** `python3 -m http.server 8000` in this folder, then open
http://localhost:8000 (opening `index.html` directly from disk will not load the data).

## Method summary

- **Unit:** one non-overlapping 10 s window (1,000 samples at 100 Hz). **Target:** the most frequent
  `label:Walmsley2020` class inside the window (sleep, sedentary, light, moderate-vigorous).
  Unlabelled windows are dropped.
- **Features:** mean, std, min and max of x, y, z and magnitude (16). No participant ID, age or sex.
- **Split:** P001–P101 train, P102–P151 test (CAPTURE-24 benchmark split). The test set is used once.
- **Tuning:** 5-fold `GroupKFold` by participant on every 10th training window; scaling (logistic
  regression only) inside the pipeline; `class_weight="balanced"`.
- **Models:** majority class (baseline), logistic regression, decision tree (depth ≤ 6, the compact
  model), random forest (the larger model).
- **Metrics:** macro-F1 (headline), balanced accuracy, per-class recall, confusion matrices; 95%
  intervals from 1,000 bootstrap resamples of the 50 test participants, paired for model differences.
- **Extra experiments:** random-split vs participant-split leakage demo; feature budget k = 1…16
  (features ranked inside each fold; compact k = smallest within 0.01 of the best CV score);
  per-person and age/sex group audit; representative errors; sensitivity check without the 8
  participants with recording gaps; learning curve over the number of training people.

## Disclosures

- **Pilot:** before the final notebook we ran one untuned pilot that looked at test scores as a
  feasibility check (forest macro-F1 0.707). No setting was chosen from it or from any test score.
- **Noticed after testing:** the feature-budget forest trained on the 10% subsample scores 0.713 on
  test with all 16 features, above the headline forest's 0.700, probably because a leaf size given as
  a fraction of rows means much larger leaves on the full data. We kept 0.700 as the headline and
  changed nothing.
- **Privacy:** the website never shows participant IDs next to individual results, and age/sex
  results are group-level only. `results/split.json` and `results/stats.csv` list the public CAPTURE-24
  participant IDs so the split and quality checks can be verified.

## AI use

We used Claude (Anthropic) to brainstorm the project design, draft and debug the notebook code,
review our outputs, suggest wording for the interpretation text, and build this website. We ran every
notebook ourselves on Kaggle, checked every reported number against the notebook outputs, rewrote the
text in our own words, and can explain every step.

## Citations

- Chan S., Yuan H., Tong C., Acquah A., Schonfeldt A., Gershuny J., Doherty A. *CAPTURE-24: A large
  dataset of wrist-worn activity tracker data collected in the wild for human activity recognition.*
  Scientific Data 11, 1135 (2024). https://doi.org/10.1038/s41597-024-03960-3
- CAPTURE-24 dataset, Oxford Research Archive, DOI 10.5287/bodleian:NGx0JOMP5 (CC BY 4.0).
- CAPTURE-24 benchmark code (train/test split, 10 s windows, Walmsley2020 labels):
  https://github.com/OxWearables/capture24
- Walmsley R., Chan S., Smith-Byrne K., et al. *Reallocation of time between device-measured movement
  behaviours and risk of incident cardiovascular disease.* British Journal of Sports Medicine 56(18),
  1008–1017 (2022). https://doi.org/10.1136/bjsports-2021-104050 (source of the 4-class grouping)
- Pedregosa F., et al. *Scikit-learn: Machine Learning in Python.* JMLR 12 (2011).
