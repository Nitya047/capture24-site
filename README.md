# Wrist-worn activity recognition for unseen users

ES 335 course project website. It reads the small result files exported by our Kaggle notebook
(`capture24-modelling`) and shows them with interactive charts. The main interactive piece is a
feature-budget explorer: keep the top k of 16 features and see macro-F1, per-class recall and the
confusion matrix change.

Plain HTML, CSS and JavaScript: no libraries and no build step.

## Files

- `index.html`, `style.css`, `app.js`: the site
- `data/`: the JSON files from the notebook's `results.zip` (plus `data/figures/*.png`)
- `import_results.sh`: copies the right files out of `results.zip` into `data/`

## Update the results

```sh
sh import_results.sh ~/Downloads/results.zip
```

## Preview locally

```sh
python3 -m http.server 8000
```
Then open http://localhost:8000. Opening `index.html` directly from disk will not load the data.

## Data and credits

CAPTURE-24 (Chan et al., *Scientific Data* 2024; DOI 10.5287/bodleian:NGx0JOMP5, CC BY 4.0).
Train/test split, windows and label grouping follow github.com/OxWearables/capture24.
No raw data and no participant IDs are published here.
