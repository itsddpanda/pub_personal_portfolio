import re
import sys
import os
from datetime import date
from unittest.mock import MagicMock
from sqlmodel import Session, SQLModel, create_engine, select

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import Scheme

# Mocking necessary parts if I were to run full service, but here I just want to test regex and DB constraint


def test_regex_extraction():
    scheme_name = "quant Equity Savings Fund - Direct Plan-Growth - ISIN: INF966L01EC8"
    match = re.search(r"ISIN:\s*([A-Z0-9]{12})", scheme_name)
    if match:
        print(f"SUCCESS: Extracted ISIN: {match.group(1)}")
    else:
        print("FAILURE: Could not extract ISIN")


def reproduce_db_error():
    engine = create_engine("sqlite://")
    SQLModel.metadata.create_all(engine)
    session = Session(engine)

    print("\nAttempting to insert Scheme with ISIN=None...")
    try:
        scheme = Scheme(
            isin=None,  # This should fail
            name="quant Equity Savings Fund - Direct Plan-Growth - ISIN: INF966L01EC8",
            type="N/A",
        )
        session.add(scheme)
        session.commit()
    except Exception as e:
        print(f"CAUGHT EXPECTED ERROR: {e}")


if __name__ == "__main__":
    test_regex_extraction()
    reproduce_db_error()
