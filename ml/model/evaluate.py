"""
HeatGuard Twin — ML: Model Evaluation
=======================================

Provides evaluation utilities and generates a visual evaluation report
(confusion matrix, ROC curves, feature importance bar chart).

Usage:
    python -m ml.model.evaluate
    python -m ml.model.evaluate --data artifacts/data/training.csv --output artifacts/eval/

DISCLAIMER:
    All outputs are from a model trained on entirely synthetic data.
    Results are illustrative only — NOT medically validated.
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

ML_ROOT = Path(__file__).parent.parent
ARTIFACTS_DIR = ML_ROOT / "artifacts"
MODEL_PATH = ARTIFACTS_DIR / "model" / "heat_stress_classifier.joblib"
DEFAULT_DATA_PATH = ARTIFACTS_DIR / "data" / "training.csv"
DEFAULT_EVAL_DIR = ARTIFACTS_DIR / "eval"


def _ensure_matplotlib() -> tuple:
    """Import matplotlib lazily so the rest of the module works without it."""
    try:
        import matplotlib
        matplotlib.use("Agg")  # Non-interactive backend — safe in CI/servers
        import matplotlib.pyplot as plt
        import seaborn as sns
        return plt, sns
    except ImportError:
        return None, None


def plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: list[str],
    output_path: Path,
) -> None:
    """Save a heatmap of the confusion matrix."""
    plt, sns = _ensure_matplotlib()
    if plt is None:
        logger.warning("matplotlib/seaborn not installed — skipping confusion matrix plot.")
        return

    from sklearn.metrics import confusion_matrix

    cm = confusion_matrix(y_true, y_pred, normalize="true")
    fig, ax = plt.subplots(figsize=(7, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt=".2f",
        cmap="Blues",
        xticklabels=class_names,
        yticklabels=class_names,
        ax=ax,
    )
    ax.set_xlabel("Predicted Label")
    ax.set_ylabel("True Label")
    ax.set_title("Confusion Matrix (row-normalised)\n⚠️ Synthetic data only")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    logger.info("Confusion matrix saved to %s", output_path)


def plot_roc_curves(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    class_names: list[str],
    output_path: Path,
) -> None:
    """Save one-vs-rest ROC curves for each class."""
    plt, sns = _ensure_matplotlib()
    if plt is None:
        logger.warning("matplotlib not installed — skipping ROC curves.")
        return

    from sklearn.metrics import roc_auc_score, roc_curve
    from sklearn.preprocessing import label_binarize

    n_classes = len(class_names)
    y_bin = label_binarize(y_true, classes=list(range(n_classes)))
    colors = ["#2563eb", "#f59e0b", "#dc2626"]

    fig, ax = plt.subplots(figsize=(8, 6))
    for i, (name, color) in enumerate(zip(class_names, colors)):
        fpr, tpr, _ = roc_curve(y_bin[:, i], y_prob[:, i])
        auc = roc_auc_score(y_bin[:, i], y_prob[:, i])
        ax.plot(fpr, tpr, color=color, lw=2, label=f"{name} (AUC={auc:.3f})")

    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set_xlabel("False Positive Rate")
    ax.set_ylabel("True Positive Rate")
    ax.set_title("One-vs-Rest ROC Curves\n⚠️ Synthetic data only")
    ax.legend(loc="lower right")
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    logger.info("ROC curves saved to %s", output_path)


def plot_feature_importance(
    importances: dict[str, float],
    output_path: Path,
) -> None:
    """Save a horizontal bar chart of feature importances."""
    plt, sns = _ensure_matplotlib()
    if plt is None:
        logger.warning("matplotlib not installed — skipping feature importance plot.")
        return

    sorted_items = sorted(importances.items(), key=lambda x: x[1])
    names = [i[0] for i in sorted_items]
    values = [i[1] for i in sorted_items]

    fig, ax = plt.subplots(figsize=(8, 5))
    bars = ax.barh(names, values, color="#2563eb")
    ax.set_xlabel("Feature Importance (gain)")
    ax.set_title("XGBoost Feature Importances\n⚠️ Synthetic data only")
    for bar, val in zip(bars, values):
        ax.text(val + 0.001, bar.get_y() + bar.get_height() / 2,
                f"{val:.3f}", va="center", fontsize=8)
    plt.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, dpi=150)
    plt.close(fig)
    logger.info("Feature importance chart saved to %s", output_path)


def evaluate(
    model_path: Path = MODEL_PATH,
    data_path: Path = DEFAULT_DATA_PATH,
    output_dir: Path = DEFAULT_EVAL_DIR,
    test_size: float = 0.2,
    seed: int = 42,
) -> dict:
    """
    Load the trained model and evaluation data, compute metrics, and
    save evaluation plots to output_dir.

    Returns:
        dict with accuracy, f1_macro, per-class report, feature_importances.
    """
    from sklearn.metrics import classification_report
    from sklearn.model_selection import train_test_split

    from ml.model.features import (
        FEATURE_COLS, TARGET_COL, RISK_LABEL_TO_NAME, get_feature_matrix
    )

    # Load model
    if not model_path.exists():
        raise FileNotFoundError(
            f"Model not found at {model_path}. Run `python -m ml.model.train` first."
        )
    pipeline = joblib.load(model_path)
    logger.info("Model loaded from %s", model_path)

    # Load data
    if not data_path.exists():
        raise FileNotFoundError(
            f"Data not found at {data_path}. Run `python -m ml.data.generate` first."
        )
    df = pd.read_csv(data_path)
    X = get_feature_matrix(df)
    y = df[TARGET_COL].astype(int)

    # Use the same test split as training
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=seed
    )

    class_names = [RISK_LABEL_TO_NAME[i] for i in sorted(RISK_LABEL_TO_NAME)]

    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)

    report_dict = classification_report(y_test, y_pred, target_names=class_names, output_dict=True)
    accuracy = float(report_dict["accuracy"])
    f1_macro = float(report_dict["macro avg"]["f1-score"])

    logger.info("Accuracy: %.4f | F1 Macro: %.4f", accuracy, f1_macro)
    logger.info("\n%s", classification_report(y_test, y_pred, target_names=class_names))

    # Feature importances
    import xgboost as xgb
    xgb_model: xgb.XGBClassifier = pipeline.named_steps["classifier"]
    importances = dict(zip(FEATURE_COLS, xgb_model.feature_importances_.tolist()))

    # Plots
    output_dir.mkdir(parents=True, exist_ok=True)
    plot_confusion_matrix(
        np.array(y_test), np.array(y_pred), class_names,
        output_dir / "confusion_matrix.png",
    )
    plot_roc_curves(
        np.array(y_test), y_prob, class_names,
        output_dir / "roc_curves.png",
    )
    plot_feature_importance(importances, output_dir / "feature_importance.png")

    # Save report JSON
    report_path = output_dir / "evaluation_report.json"
    report_path.write_text(json.dumps({
        "accuracy": accuracy,
        "f1_macro": f1_macro,
        "per_class": report_dict,
        "feature_importances": importances,
        "disclaimer": (
            "Results from a model trained on entirely synthetic data. "
            "NOT medically validated. Illustrative only."
        ),
    }, indent=2))
    logger.info("Evaluation report saved to %s", report_path)

    return {
        "accuracy": accuracy,
        "f1_macro": f1_macro,
        "classification_report": report_dict,
        "feature_importances": importances,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s: %(message)s")
    parser = argparse.ArgumentParser(description="Evaluate trained heat-stress risk classifier")
    parser.add_argument("--model", type=Path, default=MODEL_PATH)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_EVAL_DIR)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    results = evaluate(
        model_path=args.model,
        data_path=args.data,
        output_dir=args.output,
        seed=args.seed,
    )
    print(f"\nAccuracy : {results['accuracy']:.4f}")
    print(f"F1 Macro : {results['f1_macro']:.4f}")
    print(f"Plots saved to: {args.output}/")
    print("\n⚠️  DISCLAIMER: Results are from synthetic training data. NOT medically validated.")


if __name__ == "__main__":
    main()
