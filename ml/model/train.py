"""
HeatGuard Twin — ML: Model Training
=====================================

Trains an XGBoost heat-stress risk classifier with:
  - Stratified k-fold cross-validation
  - Optional Optuna hyperparameter tuning
  - Feature importance logging
  - Artifact saving (model + scaler + metadata)

Usage:
    # Quick run (no tuning)
    python -m ml.model.train

    # With Optuna hyperparameter search (recommended for production)
    python -m ml.model.train --tune --n-trials 50

    # Re-use existing data
    python -m ml.model.train --data artifacts/data/training.csv

DISCLAIMER:
    This is a proof-of-concept trained on entirely synthetic data.
    It does NOT provide medically validated predictions.
    All outputs are illustrative only.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# XGBoost
try:
    import xgboost as xgb
except ImportError:
    sys.exit("XGBoost is not installed. Run: pip install xgboost")

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ML_ROOT = Path(__file__).parent.parent
ARTIFACTS_DIR = ML_ROOT / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "model" / "heat_stress_classifier.joblib"
META_PATH = ARTIFACTS_DIR / "model" / "metadata.json"
DEFAULT_DATA_PATH = ARTIFACTS_DIR / "data" / "training.csv"


def _get_model(params: dict | None = None) -> xgb.XGBClassifier:
    """Return an XGBClassifier with sensible defaults or given params."""
    defaults: dict = {
        "n_estimators": 300,
        "max_depth": 5,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "min_child_weight": 3,
        "gamma": 0.1,
        "reg_alpha": 0.1,
        "reg_lambda": 1.0,
        "use_label_encoder": False,
        "eval_metric": "mlogloss",
        "objective": "multi:softprob",
        "num_class": 3,
        "random_state": 42,
        "n_jobs": -1,
        "verbosity": 0,
    }
    if params:
        defaults.update(params)
    return xgb.XGBClassifier(**defaults)


def tune_hyperparameters(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    n_trials: int = 30,
    cv: int = 5,
) -> dict:
    """
    Run Optuna TPE hyperparameter search.
    Returns the best parameter dict found.
    """
    try:
        import optuna
        optuna.logging.set_verbosity(optuna.logging.WARNING)
    except ImportError:
        logger.warning("Optuna not installed. Skipping tuning, using defaults.")
        return {}

    def objective(trial: "optuna.Trial") -> float:
        params = {
            "n_estimators": trial.suggest_int("n_estimators", 100, 600),
            "max_depth": trial.suggest_int("max_depth", 3, 8),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
            "subsample": trial.suggest_float("subsample", 0.5, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
            "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
            "gamma": trial.suggest_float("gamma", 0.0, 1.0),
            "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
            "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
        }
        model = _get_model(params)
        skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)
        scores = cross_val_score(
            model, X_train, y_train,
            cv=skf,
            scoring="f1_macro",
            n_jobs=-1,
        )
        return float(np.mean(scores))

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=True)
    logger.info("Best trial: f1_macro=%.4f, params=%s", study.best_value, study.best_params)
    return study.best_params


def train(
    data_path: Path = DEFAULT_DATA_PATH,
    tune: bool = False,
    n_trials: int = 30,
    test_size: float = 0.2,
    cv_folds: int = 5,
    seed: int = 42,
) -> dict:
    """
    Full training pipeline:
      1. Load & validate data
      2. Train / test split
      3. Optional hyperparameter tuning
      4. Fit final model on full training set
      5. Evaluate on held-out test set
      6. Save artifacts

    Returns:
        dict with keys: accuracy, f1_macro, classification_report, feature_importances
    """
    from ml.model.features import FEATURE_COLS, TARGET_COL, RISK_LABEL_TO_NAME, get_feature_matrix

    # ------------------------------------------------------------------
    # 1. Load data
    # ------------------------------------------------------------------
    if not data_path.exists():
        logger.info("Data not found at %s. Generating now...", data_path)
        from ml.data.generate import generate_dataset, save_dataset
        df = generate_dataset(n_samples=10_000, seed=seed)
        save_dataset(df, data_path)
    else:
        df = pd.read_csv(data_path)

    logger.info("Loaded %d samples from %s", len(df), data_path)

    X = get_feature_matrix(df)
    y = df[TARGET_COL].astype(int)

    # ------------------------------------------------------------------
    # 2. Train / test split (stratified)
    # ------------------------------------------------------------------
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=seed
    )
    logger.info(
        "Train: %d | Test: %d | Class distribution in train: %s",
        len(X_train), len(X_test),
        y_train.value_counts().to_dict(),
    )

    # ------------------------------------------------------------------
    # 3. Hyperparameter tuning (optional)
    # ------------------------------------------------------------------
    best_params: dict = {}
    if tune:
        logger.info("Running Optuna hyperparameter search (%d trials)...", n_trials)
        best_params = tune_hyperparameters(X_train, y_train, n_trials=n_trials, cv=cv_folds)

    # ------------------------------------------------------------------
    # 4. Build pipeline and fit on full training set
    # ------------------------------------------------------------------
    model = _get_model(best_params)
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("classifier", model),
    ])
    pipeline.fit(X_train, y_train)

    # Cross-validation score on training set
    skf = StratifiedKFold(n_splits=cv_folds, shuffle=True, random_state=seed)
    cv_scores = cross_val_score(
        pipeline, X_train, y_train,
        cv=skf,
        scoring="f1_macro",
        n_jobs=-1,
    )
    logger.info("CV f1_macro: %.4f ± %.4f", cv_scores.mean(), cv_scores.std())

    # ------------------------------------------------------------------
    # 5. Evaluate on held-out test set
    # ------------------------------------------------------------------
    y_pred = pipeline.predict(X_test)
    report = classification_report(
        y_test, y_pred,
        target_names=[RISK_LABEL_TO_NAME[i] for i in sorted(RISK_LABEL_TO_NAME)],
        output_dict=False,
    )
    report_dict = classification_report(
        y_test, y_pred,
        target_names=[RISK_LABEL_TO_NAME[i] for i in sorted(RISK_LABEL_TO_NAME)],
        output_dict=True,
    )
    cm = confusion_matrix(y_test, y_pred)

    accuracy = float(report_dict["accuracy"])
    f1_macro = float(report_dict["macro avg"]["f1-score"])

    logger.info("Test Accuracy: %.4f | F1 (macro): %.4f", accuracy, f1_macro)
    logger.info("Classification Report:\n%s", report)
    logger.info("Confusion Matrix:\n%s", cm)

    # Feature importances from the XGBoost classifier
    xgb_model: xgb.XGBClassifier = pipeline.named_steps["classifier"]
    importances = dict(zip(FEATURE_COLS, xgb_model.feature_importances_.tolist()))
    top_features = sorted(importances.items(), key=lambda x: x[1], reverse=True)
    logger.info("Feature importances: %s", top_features)

    # ------------------------------------------------------------------
    # 6. Save artifacts
    # ------------------------------------------------------------------
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)

    metadata = {
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "model_type": "XGBClassifier",
        "framework": "xgboost + scikit-learn pipeline",
        "n_features": len(FEATURE_COLS),
        "feature_cols": FEATURE_COLS,
        "risk_labels": RISK_LABEL_TO_NAME,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "cv_folds": cv_folds,
        "cv_f1_macro_mean": float(cv_scores.mean()),
        "cv_f1_macro_std": float(cv_scores.std()),
        "test_accuracy": accuracy,
        "test_f1_macro": f1_macro,
        "best_params": best_params,
        "feature_importances": importances,
        "disclaimer": (
            "This model is trained on entirely synthetic data for a hackathon "
            "proof-of-concept. It does NOT provide medically validated predictions. "
            "All risk assessments are illustrative only."
        ),
    }
    META_PATH.write_text(json.dumps(metadata, indent=2))

    logger.info("Model saved to %s", MODEL_PATH)
    logger.info("Metadata saved to %s", META_PATH)

    return {
        "accuracy": accuracy,
        "f1_macro": f1_macro,
        "classification_report": report_dict,
        "feature_importances": importances,
        "model_path": str(MODEL_PATH),
        "metadata_path": str(META_PATH),
    }


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    parser = argparse.ArgumentParser(description="Train HeatGuard heat-stress risk classifier")
    parser.add_argument(
        "--data",
        type=Path,
        default=DEFAULT_DATA_PATH,
        help="Path to training CSV (auto-generated if absent)",
    )
    parser.add_argument(
        "--tune",
        action="store_true",
        help="Run Optuna hyperparameter search before final training",
    )
    parser.add_argument("--n-trials", type=int, default=30, help="Optuna trials (when --tune)")
    parser.add_argument("--cv", type=int, default=5, help="Cross-validation folds")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    results = train(
        data_path=args.data,
        tune=args.tune,
        n_trials=args.n_trials,
        cv_folds=args.cv,
        seed=args.seed,
    )

    print("\n" + "=" * 60)
    print("  TRAINING COMPLETE")
    print("=" * 60)
    print(f"  Test Accuracy : {results['accuracy']:.4f}")
    print(f"  Test F1 Macro : {results['f1_macro']:.4f}")
    print(f"  Model saved to: {results['model_path']}")
    print("=" * 60)
    print("\n⚠️  DISCLAIMER: Trained on synthetic data. NOT medically validated.")


if __name__ == "__main__":
    main()
