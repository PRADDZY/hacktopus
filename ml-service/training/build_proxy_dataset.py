from __future__ import annotations

import argparse
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd

from feature_schema import (
    FEATURE_COLUMNS,
    PRIMARY_TARGET_COLUMN,
    SECONDARY_TARGET_COLUMN,
    SEGMENT_CODE_MAP,
)


def _clamp(series: pd.Series, lower: float = 0.0, upper: float = 1.0) -> pd.Series:
    return series.clip(lower=lower, upper=upper)


def _safe_divide(numerator: pd.Series, denominator: pd.Series) -> pd.Series:
    return numerator / denominator.replace(0, 1)


def _derive_affordability_target(frame: pd.DataFrame) -> pd.Series:
    burden = _clamp(frame["total_burden_ratio"], 0, 2)
    stress = _clamp(frame["stress_index"], 0, 1.5)
    thin_buffer = _clamp(1 - frame["buffer_ratio"], 0, 1.5)
    negative_days = _clamp(frame["negative_balance_days_30d"] / 30, 0, 1)
    installment_pressure = _clamp(frame["installment_to_inflow_ratio"], 0, 1.5)

    stress_score = (
        burden * 0.40
        + stress * 0.24
        + thin_buffer * 0.18
        + negative_days * 0.10
        + installment_pressure * 0.08
    )
    dynamic_threshold = float(stress_score.quantile(0.62))
    return (stress_score >= dynamic_threshold).astype(int)


def _map_segment_codes(
    monthly_inflow: pd.Series,
    stress_index: pd.Series,
    burden_ratio: pd.Series,
) -> pd.Series:
    student_mask = (monthly_inflow < 32000) & (stress_index < 0.52)
    informal_mask = (monthly_inflow < 26000) | (stress_index >= 0.72) | (burden_ratio >= 0.95)
    gig_mask = (monthly_inflow >= 32000) & (monthly_inflow < 110000)

    segment = np.full(len(monthly_inflow), SEGMENT_CODE_MAP["unknown"], dtype=int)
    segment = np.where(gig_mask, SEGMENT_CODE_MAP["gig_worker"], segment)
    segment = np.where(student_mask, SEGMENT_CODE_MAP["student"], segment)
    segment = np.where(informal_mask, SEGMENT_CODE_MAP["informal_worker"], segment)
    return pd.Series(segment, index=monthly_inflow.index)


def _finalize_frame(frame: pd.DataFrame, source_name: str) -> pd.DataFrame:
    for column in FEATURE_COLUMNS:
        if column not in frame.columns:
            frame[column] = 0.0

    frame = frame.replace([np.inf, -np.inf], np.nan).fillna(0)
    frame[FEATURE_COLUMNS] = frame[FEATURE_COLUMNS].astype(float)
    frame["segment_code"] = frame["segment_code"].astype(int)
    frame["source_dataset"] = source_name
    frame[PRIMARY_TARGET_COLUMN] = frame[PRIMARY_TARGET_COLUMN].astype(int).clip(0, 1)
    frame[SECONDARY_TARGET_COLUMN] = _derive_affordability_target(frame)

    required = FEATURE_COLUMNS + [PRIMARY_TARGET_COLUMN, SECONDARY_TARGET_COLUMN, "source_dataset"]
    return frame[required]


def _load_home_credit(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    monthly_income = df.get("AMT_INCOME_TOTAL", pd.Series(0.0, index=df.index)).astype(float).clip(lower=5000)
    loan_amount = df.get("AMT_CREDIT", pd.Series(0.0, index=df.index)).astype(float).clip(lower=1000)
    annuity = df.get("AMT_ANNUITY", pd.Series(0.0, index=df.index)).astype(float).clip(lower=0)
    employment_days = df.get("DAYS_EMPLOYED", pd.Series(-1800, index=df.index)).astype(float).abs()
    family_members = df.get("CNT_FAM_MEMBERS", pd.Series(1.0, index=df.index)).astype(float).clip(lower=1)

    monthly_outflow = (monthly_income * 0.52 + annuity * 0.55).clip(lower=0)
    inflow_volatility = _clamp(0.18 + employment_days / 7200, 0.05, 1.1)
    outflow_volatility = _clamp(0.20 + annuity / monthly_income.replace(0, 1), 0.08, 1.2)
    deposit_count_30d = _clamp(2 + family_members, 1, 12).round().astype(int)
    days_since_last_income = _clamp(6 + employment_days / 1100, 1, 30).round().astype(int)
    avg_balance = (monthly_income - monthly_outflow).clip(lower=0) * 0.42
    min_balance = (avg_balance - monthly_income * 0.08).clip(lower=-monthly_income * 0.1)
    negative_days = _clamp((annuity / monthly_income.replace(0, 1)) * 8, 0, 30).round().astype(int)
    essential_spend_ratio = _clamp(monthly_outflow / monthly_income.replace(0, 1), 0.15, 1.1)
    active_loans = _clamp(1 + family_members / 2, 1, 8).round().astype(int)
    installment = annuity
    tenure_weeks = _clamp(20 + annuity / monthly_income.replace(0, 1) * 20, 12, 72).round().astype(int)
    purchase_to_inflow = _clamp(_safe_divide(loan_amount, monthly_income), 0, 3)
    installment_to_inflow = _clamp(_safe_divide(installment, monthly_income), 0, 2)
    total_burden = _clamp(_safe_divide(monthly_outflow + installment, monthly_income), 0, 2)
    buffer_ratio = _clamp(_safe_divide(min_balance.clip(lower=0), monthly_income), 0, 3)
    stress_index = _clamp(inflow_volatility * 0.38 + total_burden * 0.62, 0, 1.5)

    frame = pd.DataFrame(
        {
            "segment_code": _map_segment_codes(monthly_income, stress_index, total_burden),
            "monthly_inflow": monthly_income,
            "monthly_outflow": monthly_outflow,
            "inflow_volatility_90d": inflow_volatility,
            "outflow_volatility_90d": outflow_volatility,
            "deposit_count_30d": deposit_count_30d,
            "days_since_last_income": days_since_last_income,
            "avg_balance_30d": avg_balance,
            "min_balance_30d": min_balance,
            "negative_balance_days_30d": negative_days,
            "essential_spend_ratio": essential_spend_ratio,
            "active_loan_count": active_loans,
            "monthly_installment_burden": installment,
            "purchase_amount": loan_amount,
            "tenure_weeks": tenure_weeks,
            "purchase_to_inflow_ratio": purchase_to_inflow,
            "installment_to_inflow_ratio": installment_to_inflow,
            "total_burden_ratio": total_burden,
            "buffer_ratio": buffer_ratio,
            "stress_index": stress_index,
            PRIMARY_TARGET_COLUMN: df["TARGET"].astype(int).clip(0, 1),
        }
    )
    return _finalize_frame(frame, "home_credit")


def _load_gmsc(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    income = df.get("MonthlyIncome", pd.Series(0.0, index=df.index)).fillna(0.0).astype(float).clip(lower=2000)
    debt_ratio = df.get("DebtRatio", pd.Series(0.5, index=df.index)).fillna(0.5).astype(float)
    revolving = (
        df.get("RevolvingUtilizationOfUnsecuredLines", pd.Series(0.4, index=df.index))
        .fillna(0.4)
        .astype(float)
    )
    late_count = df.get("NumberOfTimes90DaysLate", pd.Series(0, index=df.index)).fillna(0).astype(float)
    open_loans = (
        df.get("NumberOfOpenCreditLinesAndLoans", pd.Series(1, index=df.index))
        .fillna(1)
        .astype(float)
    )

    monthly_outflow = (income * _clamp(debt_ratio, 0, 2)).clip(lower=0)
    installment = (monthly_outflow * 0.28).clip(lower=0)
    purchase_amount = (income * 0.30 + revolving * income * 0.08).clip(lower=300)
    inflow_volatility = _clamp(0.15 + revolving * 0.65, 0.03, 1.2)
    outflow_volatility = _clamp(0.12 + revolving * 0.55 + debt_ratio * 0.25, 0.03, 1.2)
    deposit_count_30d = _clamp(4 - revolving * 2, 1, 9).round().astype(int)
    days_since_last_income = _clamp(3 + revolving * 8 + late_count / 2, 1, 30).round().astype(int)
    avg_balance = (income - monthly_outflow).clip(lower=-income * 0.15) * 0.40
    min_balance = (avg_balance - income * revolving * 0.10).clip(lower=-income * 0.25)
    negative_days = _clamp(late_count * 2 + revolving * 6, 0, 30).round().astype(int)
    essential_spend_ratio = _clamp(0.45 + debt_ratio * 0.25, 0.1, 1.2)
    tenure_weeks = _clamp(16 + debt_ratio * 24, 8, 72).round().astype(int)
    purchase_to_inflow = _clamp(_safe_divide(purchase_amount, income), 0, 3)
    installment_to_inflow = _clamp(_safe_divide(installment, income), 0, 2)
    total_burden = _clamp(_safe_divide(monthly_outflow + installment, income), 0, 2)
    buffer_ratio = _clamp(_safe_divide(min_balance.clip(lower=0), income), 0, 3)
    stress_index = _clamp(inflow_volatility * 0.42 + total_burden * 0.58, 0, 1.5)

    frame = pd.DataFrame(
        {
            "segment_code": _map_segment_codes(income, stress_index, total_burden),
            "monthly_inflow": income,
            "monthly_outflow": monthly_outflow,
            "inflow_volatility_90d": inflow_volatility,
            "outflow_volatility_90d": outflow_volatility,
            "deposit_count_30d": deposit_count_30d,
            "days_since_last_income": days_since_last_income,
            "avg_balance_30d": avg_balance,
            "min_balance_30d": min_balance,
            "negative_balance_days_30d": negative_days,
            "essential_spend_ratio": essential_spend_ratio,
            "active_loan_count": open_loans.clip(lower=0, upper=20).round().astype(int),
            "monthly_installment_burden": installment,
            "purchase_amount": purchase_amount,
            "tenure_weeks": tenure_weeks,
            "purchase_to_inflow_ratio": purchase_to_inflow,
            "installment_to_inflow_ratio": installment_to_inflow,
            "total_burden_ratio": total_burden,
            "buffer_ratio": buffer_ratio,
            "stress_index": stress_index,
            PRIMARY_TARGET_COLUMN: df["SeriousDlqin2yrs"].astype(int).clip(0, 1),
        }
    )
    return _finalize_frame(frame, "give_me_some_credit")


def _load_heloc(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    risk_performance = df.get("RiskPerformance", pd.Series("Bad", index=df.index)).astype(str)
    default_target = risk_performance.str.strip().str.lower().map({"bad": 1, "good": 0}).fillna(1).astype(int)

    ext_risk = df.get("ExternalRiskEstimate", pd.Series(60, index=df.index)).fillna(60).astype(float)
    months_recent_trade = df.get("MSinceMostRecentTradeOpen", pd.Series(18, index=df.index)).fillna(18).astype(float)
    total_trades = df.get("NumTotalTrades", pd.Series(8, index=df.index)).fillna(8).astype(float)

    monthly_inflow = (ext_risk * 760).clip(lower=5000)
    monthly_outflow = (monthly_inflow * 0.57 + total_trades * 180).clip(lower=0)
    installment = (monthly_inflow * 0.14 + total_trades * 35).clip(lower=0)
    purchase_amount = (monthly_inflow * 0.28 + total_trades * 120).clip(lower=250)
    inflow_volatility = _clamp(1 - ext_risk / 105 + months_recent_trade / 180, 0.05, 1.2)
    outflow_volatility = _clamp(0.18 + total_trades / 60 + months_recent_trade / 220, 0.05, 1.2)
    deposit_count_30d = _clamp(5 - months_recent_trade / 10, 1, 10).round().astype(int)
    days_since_last_income = _clamp(4 + months_recent_trade / 3, 1, 30).round().astype(int)
    avg_balance = (monthly_inflow - monthly_outflow).clip(lower=-monthly_inflow * 0.2) * 0.36
    min_balance = (avg_balance - monthly_inflow * 0.12).clip(lower=-monthly_inflow * 0.35)
    negative_days = _clamp(months_recent_trade / 2.2, 0, 30).round().astype(int)
    essential_spend_ratio = _clamp(monthly_outflow / monthly_inflow.replace(0, 1), 0.2, 1.2)
    tenure_weeks = _clamp(18 + total_trades, 8, 72).round().astype(int)
    purchase_to_inflow = _clamp(_safe_divide(purchase_amount, monthly_inflow), 0, 3)
    installment_to_inflow = _clamp(_safe_divide(installment, monthly_inflow), 0, 2)
    total_burden = _clamp(_safe_divide(monthly_outflow + installment, monthly_inflow), 0, 2)
    buffer_ratio = _clamp(_safe_divide(min_balance.clip(lower=0), monthly_inflow), 0, 3)
    stress_index = _clamp(inflow_volatility * 0.35 + total_burden * 0.65, 0, 1.5)

    frame = pd.DataFrame(
        {
            "segment_code": _map_segment_codes(monthly_inflow, stress_index, total_burden),
            "monthly_inflow": monthly_inflow,
            "monthly_outflow": monthly_outflow,
            "inflow_volatility_90d": inflow_volatility,
            "outflow_volatility_90d": outflow_volatility,
            "deposit_count_30d": deposit_count_30d,
            "days_since_last_income": days_since_last_income,
            "avg_balance_30d": avg_balance,
            "min_balance_30d": min_balance,
            "negative_balance_days_30d": negative_days,
            "essential_spend_ratio": essential_spend_ratio,
            "active_loan_count": total_trades.clip(lower=0, upper=25).round().astype(int),
            "monthly_installment_burden": installment,
            "purchase_amount": purchase_amount,
            "tenure_weeks": tenure_weeks,
            "purchase_to_inflow_ratio": purchase_to_inflow,
            "installment_to_inflow_ratio": installment_to_inflow,
            "total_burden_ratio": total_burden,
            "buffer_ratio": buffer_ratio,
            "stress_index": stress_index,
            PRIMARY_TARGET_COLUMN: default_target,
        }
    )
    return _finalize_frame(frame, "heloc")


def _ensure_columns(frame: pd.DataFrame, required: Iterable[str]) -> pd.DataFrame:
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(f"Mapped frame missing required columns: {missing}")
    return frame


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build unified dual-target proxy dataset for FairLens risk-v2."
    )
    parser.add_argument("--home-credit", type=Path, help="Path to Home Credit application_train.csv")
    parser.add_argument("--gmsc", type=Path, help="Path to Give Me Some Credit cs-training.csv")
    parser.add_argument("--heloc", type=Path, help="Path to HELOC CSV")
    parser.add_argument("--output", type=Path, required=True, help="Output parquet/csv path")
    args = parser.parse_args()

    frames: list[pd.DataFrame] = []
    required = FEATURE_COLUMNS + [PRIMARY_TARGET_COLUMN, SECONDARY_TARGET_COLUMN]
    if args.home_credit:
        frames.append(_ensure_columns(_load_home_credit(args.home_credit), required))
    if args.gmsc:
        frames.append(_ensure_columns(_load_gmsc(args.gmsc), required))
    if args.heloc:
        frames.append(_ensure_columns(_load_heloc(args.heloc), required))

    if not frames:
        raise SystemExit(
            "No dataset path provided. Supply at least one of --home-credit, --gmsc, --heloc."
        )

    dataset = pd.concat(frames, ignore_index=True)
    dataset = dataset.replace([np.inf, -np.inf], np.nan).fillna(0)
    dataset[PRIMARY_TARGET_COLUMN] = dataset[PRIMARY_TARGET_COLUMN].astype(int).clip(0, 1)
    dataset[SECONDARY_TARGET_COLUMN] = dataset[SECONDARY_TARGET_COLUMN].astype(int).clip(0, 1)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.suffix.lower() == ".parquet":
        dataset.to_parquet(args.output, index=False)
    else:
        dataset.to_csv(args.output, index=False)

    print(f"Saved dataset: {args.output}")
    print(f"Rows: {len(dataset)}")
    print(f"Default rate ({PRIMARY_TARGET_COLUMN}): {dataset[PRIMARY_TARGET_COLUMN].mean():.4f}")
    print(f"Stress rate ({SECONDARY_TARGET_COLUMN}): {dataset[SECONDARY_TARGET_COLUMN].mean():.4f}")


if __name__ == "__main__":
    main()
