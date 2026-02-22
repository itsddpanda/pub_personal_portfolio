import sys
import os
import unittest
from unittest.mock import MagicMock, patch
from sqlmodel import Session, SQLModel, create_engine, select
from datetime import date

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.cas_service import process_cas_data
from app.models.models import User, Portfolio, Folio, Scheme, Transaction, AMC


class TestCasService(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

    def tearDown(self):
        self.session.close()

    @patch("casparser.read_cas_pdf")
    def test_process_cas_data_success(self, mock_read_cas):
        # Mock Data
        mock_read_cas.return_value = {
            "cas_type": "DETAILED",
            "investor_info": {"name": "Test User", "email": "test@example.com"},
            "folios": [
                {
                    "folio": "123/456",
                    "PAN": "ABCDE1234F",
                    "schemes": [
                        {
                            "isin": "INF123456789",
                            "scheme": "Test Scheme",
                            "amfi": "123456",
                            "type": "EQUITY",
                            "transactions": [
                                {
                                    "date": date(2023, 1, 1),
                                    "amount": 10000.0,
                                    "units": 100.0,
                                    "nav": 100.0,
                                    "type": "PURCHASE",
                                    "balance": 100.0,
                                }
                            ],
                        }
                    ],
                }
            ],
        }

        # Run Service
        result = process_cas_data(self.session, b"fake_pdf_content", "password")

        # Verify Result
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["new_transactions"], 1)
        self.assertEqual(result["pan"], "ABCDE1234F")

        # Verify DB Persistence
        user = self.session.exec(select(User)).first()
        self.assertEqual(user.name, "Test User")
        self.assertEqual(user.pan, "ABCDE1234F")

        txn = self.session.exec(select(Transaction)).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.amount, 10000.0)
        self.assertEqual(txn.units, 100.0)

    @patch("casparser.read_cas_pdf")
    def test_deduplication(self, mock_read_cas):
        # Mock Data
        mock_data = {
            "cas_type": "DETAILED",
            "investor_info": {"name": "Test User"},
            "folios": [
                {
                    "folio": "123",
                    "PAN": "ABCDE1234F",
                    "schemes": [
                        {
                            "isin": "INF123",
                            "scheme": "Test Scheme",
                            "transactions": [
                                {
                                    "date": date(2023, 1, 1),
                                    "amount": 5000.0,
                                    "units": 50.0,
                                    "nav": 100.0,
                                    "type": "SIP",
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        mock_read_cas.return_value = mock_data

        # First Run
        process_cas_data(self.session, b"content", "pwd")

        # Second Run (Duplicate)
        result = process_cas_data(self.session, b"content", "pwd")

        # Verify
        self.assertEqual(result["new_transactions"], 0)
        self.assertEqual(result["skipped_transactions"], 1)

    @patch("casparser.read_cas_pdf")
    def test_amc_linking(self, mock_read_cas):
        """Test that Schemes are linked to AMCs."""
        # Mock Data with AMC info
        mock_read_cas.return_value = {
            "cas_type": "DETAILED",
            "investor_info": {"name": "Test User"},
            "folios": [
                {
                    "folio": "123",
                    "PAN": "ABCDE1234F",
                    "amc": "HDFC Mutual Fund",
                    "schemes": [
                        {
                            "isin": "INF123",
                            "scheme": "HDFC Top 100",
                            "amfi": "123456",
                            "type": "EQUITY",
                            "transactions": [],
                        }
                    ],
                }
            ],
        }

        # Run Service
        process_cas_data(self.session, b"content", "pwd")

        # Verify AMC Created
        amc = self.session.exec(select(AMC).where(AMC.name == "HDFC")).first()
        self.assertIsNotNone(amc)

        # Verify Scheme Linked
        scheme = self.session.exec(
            select(Scheme).where(Scheme.isin == "INF123")
        ).first()
        self.assertEqual(scheme.amc_id, amc.id)

    @patch("casparser.read_cas_pdf")
    def test_isin_fallback(self, mock_read_cas):
        """Test ISIN extraction from scheme name when missing in parsed data."""
        mock_read_cas.return_value = {
            "cas_type": "DETAILED",
            "investor_info": {"name": "Test User"},
            "folios": [
                {
                    "folio": "123",
                    "PAN": "ABCDE1234F",
                    "schemes": [
                        {
                            "isin": None,
                            "scheme": "quant Equity Savings Fund - Direct Plan-Growth - ISIN: INF966L01EC8",
                            "amfi": "123456",
                            "type": "EQUITY",
                            "transactions": [
                                {
                                    "date": date(2023, 1, 1),
                                    "amount": 5000.0,
                                    "units": 50.0,
                                    "nav": 100.0,
                                    "type": "PURCHASE",
                                }
                            ],
                        }
                    ],
                }
            ],
        }

        # Run Service
        result = process_cas_data(self.session, b"content", "pwd")

        # Verify Success
        self.assertEqual(result["status"], "success")
        self.assertEqual(result["new_transactions"], 1)

        # Verify Scheme Created with Correct ISIN
        scheme = self.session.exec(
            select(Scheme).where(Scheme.isin == "INF966L01EC8")
        ).first()
        self.assertIsNotNone(scheme)
        self.assertEqual(scheme.name, "quant Equity Savings Fund - Direct Plan-Growth")


if __name__ == "__main__":
    unittest.main()
