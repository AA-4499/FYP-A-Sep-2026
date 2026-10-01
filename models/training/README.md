# Models Layer: Offline Machine Learning Training

This directory contains offline machine learning training scripts and exploratory notebooks for the **ShanghaiT2DM longitudinal dataset**.

## Workflow
1. Load features from `data/loaders/shanghai_loader.py` or preprocessed tables in `data/processed/`.
2. Train temporal models (e.g. Temporal XGBoost, LightGBM, BiLSTM, or GRU).
3. Evaluate classification and regression performance against AUROC, AUPRC, and F1-score.
4. Export trained weights to `models/weights/` (e.g. `shanghai_risk_model.pkl`).
5. The production web backend at `web/backend/services/risk_model_service.py` will automatically load exported weights from `models/weights/`.
