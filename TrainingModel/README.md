# Shanghai T2DM CGM Forecasting & Interactive App

This folder (`TrainingModel`) is a self-contained module containing:
1. **The Machine Learning Pipeline (`FYP_A_new`)**: A PyTorch GRU model trained on the Shanghai T2DM CGM dataset using chronological 80/20 train/test splits.
2. **The Interactive Web App (`app.py`)**: A Streamlit dashboard with 3-, 6-, and 12-hour future CGM forecasting and a "what-if" simulator for meal and insulin events.
3. **Dataset (`data/Shanghai_T2DM`)**: The raw patient Excel workbooks used for training and inference.
4. **Pretrained Checkpoint & Artifacts (`FYP_A_new/outputs`)**: Includes the trained model weights (`gru_t2dm_forecaster.pt`), evaluation metrics, and test predictions.

---

## Folder Structure

```text
TrainingModel/
├── app.py                      # Streamlit dashboard application
├── requirements.txt            # Python dependencies
├── RUN_COMMANDS.txt            # Quick command reference
├── README.md                   # This documentation
├── .gitignore                  # Git ignore rules for clean repository
├── data/
│   ├── Shanghai_T2DM/          # 110 raw patient Excel files (.xlsx, .xls)
│   └── cleaned_Shanghai_T2DM_Summary.xlsx
└── FYP_A_new/
    ├── __init__.py
    ├── t2dm_pipeline.py        # Core model architecture, loading & split logic
    ├── train_t2dm.py           # Training entrypoint script
    ├── test_t2dm_pipeline.py   # Unit & split validation tests
    ├── t2dm_training.ipynb     # Jupyter notebook for experiments
    ├── requirements.txt
    └── outputs/
        ├── gru_t2dm_forecaster.pt   # Pretrained model checkpoint
        ├── metrics.json             # Test metrics & performance
        ├── test_predictions.csv     # Held-out actual vs predicted values
        └── timeline_splits.csv      # Patient split records
```

---

## Quick Start

### 1. Set Up Environment

From inside the `TrainingModel` folder:

```powershell
python -m venv .venv

# Activate the environment:
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# Windows CMD:
.\.venv\Scripts\activate.bat
# Linux / macOS:
source .venv/bin/activate

# Install dependencies:
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Run the Streamlit Web Application

The repository already includes the pretrained model checkpoint (`FYP_A_new/outputs/gru_t2dm_forecaster.pt`), so you can launch the app immediately without retraining:

```powershell
streamlit run app.py --server.port 8502
```

Then open your browser at `http://localhost:8502`.

### 3. (Optional) Retrain the Model

If you wish to retrain the GRU model from scratch:

```powershell
python -m FYP_A_new.train_t2dm
```

For a quick test run (smoke test):

```powershell
python -m FYP_A_new.train_t2dm --epochs 2 --batch-size 512 --training-stride 4
```

### 4. Run Unit Tests

To verify that the data loading and sequence windowing pipeline works correctly:

```powershell
python -m unittest discover -s .\FYP_A_new -p "test_*.py"
```

---

## Important Notes for Group Members

- **Relative Paths**: All scripts resolve data and checkpoint paths relative to `TrainingModel/`. No hardcoded local machine paths are used.
- **Model Checkpoint**: `FYP_A_new/outputs/gru_t2dm_forecaster.pt` (~170 KB) is committed so the app can run immediately upon checkout without needing a lengthy training step.
- **Git Hygiene**: Do NOT push `.venv/`, `__pycache__/`, or temporary Excel lock files (`~$*`). These are excluded in `.gitignore`.
