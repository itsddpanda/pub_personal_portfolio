import sys
import os
import unittest
from unittest.mock import MagicMock, patch
from datetime import date
from sqlmodel import Session, SQLModel, create_engine, select

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.nav import backfill_historical_nav
from app.models.models import Scheme, NavHistory


class TestNavBackfill(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        # Setup Scheme
        self.scheme = Scheme(
            isin="INF123456789", name="Test Scheme", amfi_code="112090", type="EQUITY"
        )
        self.session.add(self.scheme)
        self.session.commit()
        self.session.refresh(self.scheme)

    def tearDown(self):
        self.session.close()

    @patch("app.services.nav.requests.get")
    def test_backfill_historical_nav_success(self, mock_get):
        # Mock Response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "SUCCESS",
            "data": [
                {"date": "20-02-2026", "nav": "87.92500"},
                {"date": "19-02-2026", "nav": "87.10000"},
                {"date": "18-02-2026", "nav": "86.50000"},
            ],
        }
        mock_get.return_value = mock_response

        # Run backfill
        success = backfill_historical_nav(
            self.session, self.scheme.id, self.scheme.amfi_code
        )

        self.assertTrue(success)

        # Verify NavHistory records were created
        history = self.session.exec(
            select(NavHistory).where(NavHistory.scheme_id == self.scheme.id)
        ).all()
        self.assertEqual(len(history), 3)

        # Verify latest NAV cache was updated
        self.session.refresh(self.scheme)
        self.assertEqual(self.scheme.latest_nav, 87.925)
        self.assertEqual(self.scheme.latest_nav_date, date(2026, 2, 20))

        # Verify idempotency (running again shouldn't duplicate)
        success2 = backfill_historical_nav(
            self.session, self.scheme.id, self.scheme.amfi_code
        )
        self.assertTrue(success2)
        history_after = self.session.exec(
            select(NavHistory).where(NavHistory.scheme_id == self.scheme.id)
        ).all()
        self.assertEqual(len(history_after), 3)  # Still 3


if __name__ == "__main__":
    unittest.main()
