from sqlmodel import Session, SQLModel, create_engine, Field, select
from typing import Optional


class Transaction(SQLModel, table=True):
    id: str = Field(primary_key=True)
    amount: float


def test_dedup():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)

    txn_id = "ba945e557114b56961269f01a840f333fb6b6a6baec73cb8d5f7332a7a76c7ed"

    with Session(engine) as session:
        # Run 1: Insert
        print("Run 1: Inserting...")
        existing = session.get(Transaction, txn_id)
        if existing:
            print("  Found existing (unexpected)")
        else:
            print("  Not found. Adding new.")
            t = Transaction(id=txn_id, amount=100.0)
            session.add(t)
            session.commit()
            print("  Committed.")

        # Run 2: Check
        print("Run 2: Checking...")
        existing = session.get(Transaction, txn_id)
        if existing:
            print(f"  Found existing: {existing.id}")
        else:
            print("  FAIL: Not found!")

        # Run 3: Insert Duplicate
        print("Run 3: Inserting Duplicate...")
        if session.get(Transaction, txn_id):
            print("  Skipped (Correct)")
        else:
            print("  FAIL: Would insert duplicate")


if __name__ == "__main__":
    test_dedup()
