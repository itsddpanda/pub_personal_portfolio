import sys
import os
import unittest
from unittest.mock import MagicMock, patch
from datetime import date
from sqlmodel import Session, SQLModel, create_engine, select

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.nav import fetch_latest_nav, sync_navs
from app.models.models import Scheme, NavHistory


class TestNavService(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        # Setup Scheme
        self.scheme = Scheme(
            isin="INF123456789", name="Test Fund", amfi_code="123456", type="EQUITY"
        )
        self.session.add(self.scheme)
        self.session.commit()

    def tearDown(self):
        self.session.close()

    @patch("requests.get")
    def test_fetch_latest_nav_success(self, mock_get):
        # Mock Response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "meta": {
                "fund_house": "Test House",
                "scheme_type": "Open Ended",
                "scheme_category": "Equity",
                "scheme_code": 123456,
                "scheme_name": "Test Fund",
            },
            "data": [
                {"date": "15-02-2024", "nav": "150.50"},
                {"date": "14-02-2024", "nav": "149.00"},
            ],
            "status": "SUCCESS",
        }
        mock_get.return_value = mock_response

        nav, nav_date = fetch_latest_nav("123456")

        self.assertEqual(nav, 150.50)
        self.assertEqual(nav_date, date(2024, 2, 15))

    @patch("requests.get")
    def test_sync_navs(self, mock_get):
        # Mock Response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [{"date": "20-02-2024", "nav": "200.00"}],
            "status": "SUCCESS",
        }
        mock_get.return_value = mock_response

        # Run Sync
        result = sync_navs(self.session)

        self.assertEqual(result["updated"], 1)
        self.assertEqual(result["errors"], 0)

        # Verify DB Update
        updated_scheme = self.session.exec(
            select(Scheme).where(Scheme.amfi_code == "123456")
        ).first()
        self.assertEqual(updated_scheme.latest_nav, 200.0)
        self.assertEqual(updated_scheme.latest_nav_date, date(2024, 2, 20))

        # Verify History Entry
        history = self.session.exec(select(NavHistory)).first()
        self.assertIsNotNone(history)
        self.assertEqual(history.nav, 200.0)
        self.assertEqual(history.date, date(2024, 2, 20))


if __name__ == "__main__":
    unittest.main()
