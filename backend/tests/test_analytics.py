import sys
import os
import unittest
from datetime import date
from sqlmodel import Session, SQLModel, create_engine, select
from uuid import uuid4

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.analytics import get_portfolio_summary
from app.models.models import User, Portfolio, Folio, Scheme, Transaction


class TestAnalytics(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        SQLModel.metadata.create_all(self.engine)
        self.session = Session(self.engine)

        # Setup Base Data
        self.user = User(pan="TESTPAN123", name="Test Investor")
        self.session.add(self.user)
        self.session.commit()

        self.portfolio = Portfolio(user_id=self.user.id, name="Main")
        self.session.add(self.portfolio)
        self.session.commit()

        self.folio = Folio(portfolio_id=self.portfolio.id, folio_number="FOLIO1")
        self.session.add(self.folio)
        self.session.commit()

        self.scheme = Scheme(
            isin="INF123456789", name="Growth Fund", type="EQUITY", latest_nav=120.0
        )
        self.session.add(self.scheme)
        self.session.commit()

    def tearDown(self):
        self.session.close()

    def test_simple_investment(self):
        """Test simple purchase and current value calculation."""
        # Purchase: 100 units @ NAV 100 (Invested: 10,000)
        t1 = Transaction(
            id="txn1",
            folio_id=self.folio.id,
            scheme_id=self.scheme.id,
            date=date(2023, 1, 1),
            type="PURCHASE",
            amount=10000.0,
            units=100.0,
            nav=100.0,
        )
        self.session.add(t1)
        self.session.commit()

        # Latest NAV is 120 (set in setUp)
        # Expected Value: 100 units * 120 = 12,000
        # Expected XIRR: Positive (approx > 20% annualized since it's > 1 year)

        summary = get_portfolio_summary(self.session, str(self.user.id))

        self.assertEqual(summary["invested_value"], 10000.0)
        self.assertEqual(summary["total_value"], 12000.0)
        self.assertEqual(len(summary["holdings"]), 1)
        self.assertTrue(summary["xirr"] > 0)
        self.assertEqual(summary["holdings"][0]["units"], 100.0)

    def test_sip_xirr(self):
        """Test SIP scenario with multiple transactions."""
        # SIP 1: Jan 1, 2023
        self.session.add(
            Transaction(
                id="sip1",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 1, 1),
                type="SIP",
                amount=5000.0,
                units=50.0,
                nav=100.0,
            )
        )

        # SIP 2: July 1, 2023
        self.session.add(
            Transaction(
                id="sip2",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 7, 1),
                type="SIP",
                amount=5500.0,
                units=50.0,
                nav=110.0,
            )
        )
        self.session.commit()

        # Total Invested: 10,500
        # Total Units: 100
        # Current Value (NAV 120): 12,000

        summary = get_portfolio_summary(self.session, str(self.user.id))

        self.assertEqual(summary["invested_value"], 10500.0)
        self.assertAlmostEqual(summary["total_value"], 12000.0)
        self.assertTrue(summary["xirr"] > 0)

    def test_redemption_impact(self):
        """Test interaction of purchases and redemptions."""
        # Buy 100 units
        self.session.add(
            Transaction(
                id="buy1",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 1, 1),
                type="PURCHASE",
                amount=10000.0,
                units=100.0,
                nav=100.0,
            )
        )

        # Sell 50 units (Half)
        self.session.add(
            Transaction(
                id="sell1",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 6, 1),
                type="REDEMPTION",
                amount=6000.0,
                units=50.0,
                nav=120.0,
            )
        )
        self.session.commit()

        # Remaining Units: 50
        # Current Value (NAV 120): 50 * 120 = 6,000
        # Invested Value (FIFO):
        # - Bought 100 @ 100 = 10,000
        # - Sold 50 (First 50 of Batch 1) -> Cost basis removed: 50 * 100 = 5,000
        # - Remaining Cost: 10,000 - 5,000 = 5,000

        summary = get_portfolio_summary(self.session, str(self.user.id))

        self.assertEqual(summary["holdings"][0]["units"], 50.0)
        self.assertEqual(summary["total_value"], 6000.0)
        self.assertEqual(summary["invested_value"], 5000.0)

    def test_fifo_complex_scenario(self):
        """Test FIFO with multiple buys and partial sells."""
        # Buy 1: 50 units @ 100 (Cost: 5000)
        self.session.add(
            Transaction(
                id="b1",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 1, 1),
                type="PURCHASE",
                amount=5000.0,
                units=50.0,
                nav=100.0,
            )
        )

        # Buy 2: 50 units @ 200 (Cost: 10000)
        self.session.add(
            Transaction(
                id="b2",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 2, 1),
                type="PURCHASE",
                amount=10000.0,
                units=50.0,
                nav=200.0,
            )
        )

        # Sell 1: 30 units (From Buy 1)
        # Removed Cost: 30 * 100 = 3000
        # Remaining Cost: (20 * 100) + (50 * 200) = 2000 + 10000 = 12000
        self.session.add(
            Transaction(
                id="s1",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 3, 1),
                type="REDEMPTION",
                amount=3600.0,
                units=30.0,
                nav=120.0,
            )
        )

        # Sell 2: 40 units (20 from Buy 1, 20 from Buy 2)
        # From Buy 1: 20 * 100 = 2000 (Batch 1 exhausted)
        # From Buy 2: 20 * 200 = 4000
        # Total Removed Cost: 6000
        # Remaining Cost: 30 * 200 = 6000
        self.session.add(
            Transaction(
                id="s2",
                folio_id=self.folio.id,
                scheme_id=self.scheme.id,
                date=date(2023, 4, 1),
                type="REDEMPTION",
                amount=6000.0,
                units=40.0,
                nav=150.0,
            )
        )

        self.session.commit()

        summary = get_portfolio_summary(self.session, str(self.user.id))

        self.assertEqual(summary["holdings"][0]["units"], 30.0)
        self.assertEqual(summary["invested_value"], 6000.0)


if __name__ == "__main__":
    unittest.main()
