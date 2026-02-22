import requests
import logging
from datetime import date
from typing import Dict, Optional

logger = logging.getLogger(__name__)


def fetch_historical_amfi_nav(target_date: date) -> Optional[Dict[str, float]]:
    """
    Fetches the historical NAV from AMFI for a specific date.
    Returns a dictionary mapping AMFI Code to the NAV value for that date.
    """
    date_str = target_date.strftime("%d-%b-%Y")  # e.g., 03-Oct-2023
    url = f"https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt={date_str}"

    logger.info(f"Fetching AMFI fallback data for date: {date_str}")

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()

        lines = response.text.splitlines()
        if len(lines) < 2:
            logger.warning(f"AMFI returned empty or invalid data for {date_str}")
            return None

        nav_map = {}
        for line in lines:
            line = line.strip()
            parts = line.split(";")

            # Format: Scheme Code;Scheme Name;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Net Asset Value;Repurchase Price;Sale Price;Date
            if len(parts) >= 5 and parts[0].strip().isdigit():
                amfi_code = parts[0].strip()
                nav_str = parts[4].strip()

                try:
                    nav_map[amfi_code] = float(nav_str)
                except ValueError:
                    # Skip 'N.A.' or invalid parsing
                    continue

        return nav_map

    except Exception as e:
        logger.error(f"Error fetching historical NAV from AMFI: {e}")
        return None
