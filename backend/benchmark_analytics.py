import os
import sys
import time
import random
from datetime import date, timedelta
from collections import defaultdict
from sqlmodel import Session, SQLModel, create_engine, select

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.models.models import User, Portfolio, Folio, Scheme, Transaction
from app.services.analytics import get_portfolio_summary

# Setup an in-memory database for testing
engine = create_engine("sqlite://")
SQLModel.metadata.create_all(engine)


def seed_benchmark_data(num_txns=2000):
    with Session(engine) as session:
        # Create a user
        user = User(pan="ABCDE1234F", name="Benchmark User")
        session.add(user)
        session.commit()
        session.refresh(user)

        # Create a portfolio
        portfolio = Portfolio(user_id=user.id, name="Benchmark Portfolio")
        session.add(portfolio)
        session.commit()
        session.refresh(portfolio)

        # Create a folio
        folio = Folio(portfolio_id=portfolio.id, folio_number="12345/67")
        session.add(folio)
        session.commit()
        session.refresh(folio)

        # Create 3 schemes
        schemes = [
            Scheme(
                isin="INF001",
                name="Scheme 1",
                amfi_code="100001",
                type="EQUITY",
                latest_nav=100.0,
            ),
            Scheme(
                isin="INF002",
                name="Scheme 2",
                amfi_code="100002",
                type="EQUITY",
                latest_nav=200.0,
            ),
            Scheme(
                isin="INF003",
                name="Scheme 3",
                amfi_code="100003",
                type="EQUITY",
                latest_nav=50.0,
            ),
        ]
        for s in schemes:
            session.add(s)
        session.commit()
        for s in schemes:
            session.refresh(s)

        # Seed 2000 transactions
        start_date = date(2020, 1, 1)
        for i in range(num_txns):
            s = random.choice(schemes)
            t_date = start_date + timedelta(days=i)
            # Alternate between purchase and redemption (mostly purchase to keep positive units)
            t_type = "PURCHASE" if random.random() > 0.2 else "REDEMPTION"
            t_amount = random.uniform(5000, 10000)
            t_units = t_amount / (s.latest_nav * 0.95)  # Approx units

            # Deterministic hash for test
            raw = f"ABCDE1234F|{s.isin}|{t_date.isoformat()}|{t_amount}|{t_type}|{t_units}"
            import hashlib

            txn_id = hashlib.sha256(raw.encode()).hexdigest()

            txn = Transaction(
                id=txn_id,
                folio_id=folio.id,
                scheme_id=s.id,
                date=t_date,
                type=t_type,
                amount=t_amount,
                units=t_units,
                nav=s.latest_nav * 0.95,
                balance=0.0,
            )
            session.add(txn)

        session.commit()
        return str(user.id)


def run_baseline(user_id):
    print(f"\n--- Running Baseline Analytics ---")
    start_time = time.time()

    with Session(engine) as session:
        summary = get_portfolio_summary(session, user_id)

    end_time = time.time()

    print(f"Total Value: ₹{summary['total_value']:,.2f}")
    print(f"Invested Value: ₹{summary['invested_value']:,.2f}")
    print(f"XIRR: {summary['xirr']:.2f}%")
    print(f"Execution Time: {(end_time - start_time) * 1000:.2f} ms")

    return summary


def run_manual_verify(user_id):
    print(f"\n--- Running Manual Python Verification ---")
    start_time = time.time()

    # This simulates the OLD logic
    with Session(engine) as session:
        statement = (
            select(Transaction, Scheme)
            .join(Folio)
            .join(Portfolio)
            .join(Scheme)
            .where(Portfolio.user_id == user_id)
        )
        results = session.exec(statement).all()

        total_inflow = 0
        units_map = defaultdict(float)
        for txn, scheme in results:
            if txn.type.upper() in ["PURCHASE", "SIP", "SWITCH IN", "STP IN"]:
                total_inflow += txn.amount
                units_map[scheme.isin] += txn.units
            elif txn.type.upper() in ["REDEMPTION", "SWITCH OUT", "STP OUT", "SWP"]:
                units_map[scheme.isin] -= txn.units
            elif txn.type.upper() == "DIVIDEND":
                pass  # Doesn't affect units or inflow (in our simple toggle)

        total_val = 0
        for isin, units in units_map.items():
            if units > 0.001:
                s = session.exec(select(Scheme).where(Scheme.isin == isin)).first()
                total_val += units * s.latest_nav

    end_time = time.time()
    print(f"Manual Total Value: ₹{total_val:,.2f}")
    print(f"Manual Total Invested: ₹{total_inflow:,.2f}")
    print(f"Manual Time: {(end_time - start_time) * 1000:.2f} ms")
    return total_val, total_inflow


if __name__ == "__main__":
    u_id = seed_benchmark_data(num_txns=2000)

    m_val, m_invested = run_manual_verify(u_id)

    baseline_stats = run_baseline(u_id)

    # Integrity Check
    diff_val = abs(baseline_stats["total_value"] - m_val)
    diff_invested = abs(baseline_stats["invested_value"] - m_invested)

    print(f"\n--- Integrity Report ---")
    if diff_val < 0.01 and diff_invested < 0.01:
        print("✅ SUCCESS: Optimized SQL results match manual Python logic.")
    else:
        print(
            f"❌ FAILURE: Results mismatch! Value Diff: {diff_val}, Invested Diff: {diff_invested}"
        )
