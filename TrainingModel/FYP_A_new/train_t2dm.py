from __future__ import annotations

import argparse

if __package__:
    from .t2dm_pipeline import (
        DEFAULT_DATA_DIR,
        DEFAULT_OUTPUT_DIR,
        DEFAULT_TRAIN_WINDOW_STRIDE,
        train_and_evaluate,
    )
else:
    from t2dm_pipeline import (
        DEFAULT_DATA_DIR,
        DEFAULT_OUTPUT_DIR,
        DEFAULT_TRAIN_WINDOW_STRIDE,
        train_and_evaluate,
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train and test a chronological Shanghai T2DM CGM forecasting GRU."
    )
    parser.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--sequence-length", type=int, default=24)
    parser.add_argument("--hidden-dim", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument(
        "--training-stride",
        type=int,
        default=DEFAULT_TRAIN_WINDOW_STRIDE,
        help="Target stride for training/validation windows; test windows always use every sample.",
    )
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--device", default=None, help="Optional torch device, e.g. cpu or cuda.")
    args = parser.parse_args()

    if args.epochs < 1:
        parser.error("--epochs must be positive.")
    if args.batch_size < 1:
        parser.error("--batch-size must be positive.")
    if args.sequence_length < 1:
        parser.error("--sequence-length must be positive.")
    if args.hidden_dim < 2:
        parser.error("--hidden-dim must be at least 2.")
    if args.learning_rate <= 0:
        parser.error("--learning-rate must be positive.")
    if args.training_stride < 1:
        parser.error("--training-stride must be positive.")

    result = train_and_evaluate(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        epochs=args.epochs,
        batch_size=args.batch_size,
        sequence_length=args.sequence_length,
        hidden_dim=args.hidden_dim,
        learning_rate=args.learning_rate,
        training_stride=args.training_stride,
        seed=args.seed,
        device_name=args.device,
    )
    print(f"\nHeld-out metrics: {result['test_metrics']}")
    print(f"Outputs: {args.output_dir}")


if __name__ == "__main__":
    main()
