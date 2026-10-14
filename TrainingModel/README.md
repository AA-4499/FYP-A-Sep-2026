# Shanghai T2DM CGM Forecasting & Interactive App

https://fyp-a-sep-2026-ofbasegafygutnvrv8fc8p.streamlit.app/
This folder (`TrainingModel`) is a self-contained module containing:
1. **The Machine Learning Pipeline (`FYP_A_new`)**: A PyTorch GRU model trained on the Shanghai T2DM Continuous Glucose Monitoring (CGM) dataset using chronological 80/20 train/test splits.
2. **Cloud Training Pipeline (`train_from_supabase.py`)**: An automated end-to-end pipeline that pulls patient data from Supabase (`patient_detail`), trains the model, and uploads point-by-point predictions and evaluation metrics back to Supabase.
3. **Interactive Web App (`app.py`)**: A Streamlit dashboard supporting live Supabase cloud data or local Excel workbooks, providing 3-, 6-, and 12-hour CGM forecasting and a "what-if" simulator for meal and insulin events.
4. **Exported Model Weights & Outputs**: Trained model checkpoints (`gru_t2dm_forecaster.pt`), evaluation metrics, and timeline split metadata stored in `FYP_A_new/outputs/`, as well as exported to the repository-wide `models/training/` and `models/weights/` directories.

---

## Directory Structure

```text
TrainingModel/
├── app.py                      # Streamlit interactive forecasting application
├── train_from_supabase.py      # Cloud pipeline: train model using Supabase data & sync outputs
├── supabase_output_tables.sql  # SQL schema to create output tables in Supabase
├── requirements.txt            # Python dependencies (NumPy, PyTorch, Streamlit, etc.)
├── RUN_COMMANDS.txt            # Quick command cheatsheet
├── README.md                   # This documentation guide
├── .env.example                # Sample environment configuration for Supabase
├── data/
│   ├── Shanghai_T2DM/          # Raw patient Excel workbooks (.xlsx, .xls)
│   └── cleaned_Shanghai_T2DM_Summary.xlsx
└── FYP_A_new/
    ├── __init__.py
    ├── t2dm_pipeline.py        # Core GRU model architecture, data loading & feature engineering
    ├── train_t2dm.py           # Local dataset training script
    ├── test_t2dm_pipeline.py   # Unit & regression tests
    ├── t2dm_training.ipynb     # Jupyter notebook for exploratory experiments
    └── outputs/
        ├── gru_t2dm_forecaster.pt   # Trained GRU model checkpoint
        ├── metrics.json             # MAE, RMSE and training parameters
        ├── test_predictions.csv     # Held-out actual vs predicted values
        └── timeline_splits.csv      # Patient train/val/test split boundaries
```

---

## Where the Trained Models are Stored

The trained model checkpoint (`gru_t2dm_forecaster.pt`) is placed in the following standardized locations:

| Path | Purpose |
| :--- | :--- |
| `TrainingModel/FYP_A_new/outputs/gru_t2dm_forecaster.pt` | Used directly by `TrainingModel/app.py` for local and cloud forecasting. |
| `models/training/gru_t2dm_forecaster.pt` | Standard repository model training archive alongside training logs and metrics. |
| `models/weights/gru_t2dm_forecaster.pt` | Production weights directory for integration with `web/backend` microservices. |

---

## Quick Start Guide

### 1. Environment Setup

> [!NOTE]
> On Windows systems where multiple Python versions are installed, always use **`py -3`** to ensure Python 3 is invoked rather than legacy Python 2.

```powershell
cd TrainingModel

# Upgrade pip and install dependencies with Python 3:
py -3 -m pip install -r requirements.txt
```

---

### 2. Run the Streamlit Web Application

The repository already comes with the trained model weights, so you can start the application immediately:

```powershell
py -3 -m streamlit run app.py
```

Then open your browser at `http://localhost:8501`.

#### Features inside the App:
- **Data Source Selector**: Choose between **`☁️ Supabase Cloud (Live DB)`** (connects directly to Supabase to fetch `patient_detail` and predictions) and **`📁 Local Excel Workbooks`**.
- **Patient Timeline Explorer**: View continuous glucose monitoring history for any patient record.
- **What-if Simulator**: Test the impact of adding hypothetical meals (food mass in grams) or insulin doses (bolus / basal) at specific times to see projected 3h, 6h, or 12h glucose trajectories.
- **Model Evaluation Details**: Review live MAE and RMSE metrics fetched directly from Supabase or local logs.

---

### 3. Train Using Supabase Data (`train_from_supabase.py`)

#### Run the Training Pipeline
```powershell
# Run 30 epochs and upload outputs to Supabase:
py -3 train_from_supabase.py --epochs 30 --batch-size 128

# Fast smoke test run (2 epochs):
py -3 train_from_supabase.py --epochs 2 --batch-size 256

# Train locally only without writing back to Supabase:
py -3 train_from_supabase.py --epochs 10 --skip-upload
```

Once completed, the new weights are saved locally and all predictions and metrics are automatically synced to your Supabase tables.

---

### Deploy Streamlit to the Web (Streamlit Community Cloud)

You can deploy this dashboard to the web completely free:

1. Push your latest code and weights to GitHub:
   ```powershell
   git add .
   git commit -m "feat: update training models and app"
   git push origin TrainingModel
   ```
2. Go to [share.streamlit.io](https://share.streamlit.io/) and log in with GitHub.
3. Click **"New app"**:
   - **Repository**: `AA-4499/FYP-A-Sep-2026`
   - **Branch**: `TrainingModel`
   - **Main file path**: `TrainingModel/app.py`
   - **App URL**: Choose a custom subdomain (e.g. `t2dm-cgm-forecast`)
4. Click **"Deploy!"**. Your application will be live at `https://your-custom-name.streamlit.app` and accessible worldwide.

---

### 5. Running Unit Tests

To verify data preprocessing, temporal alignment, and feature calculations:

```powershell
py -3 -m unittest discover -s .\FYP_A_new -p "test_*.py"
```
