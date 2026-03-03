import re
from typing import List, Sequence


ISIN_REGEX = re.compile(r"^[A-Z0-9]{12}$")


def is_valid_isin(isin: str) -> bool:
    """Return True when ISIN contains exactly 12 uppercase alphanumeric chars."""
    if not isinstance(isin, str):
        return False
    return bool(ISIN_REGEX.fullmatch(isin.strip()))


def normalize_and_validate_isin(isin: str) -> str:
    """Normalize an ISIN input and raise ValueError if format is invalid."""
    if not isinstance(isin, str):
        raise ValueError("ISIN must be a string.")

    normalized = isin.strip()
    if not is_valid_isin(normalized):
        raise ValueError(
            "Invalid ISIN format. Expected 12 uppercase alphanumeric characters."
        )

    return normalized


def parse_and_validate_isin_csv(isin_csv: str, max_items: int = 50) -> List[str]:
    """Parse comma-separated ISIN values and validate each item."""
    if not isinstance(isin_csv, str) or not isin_csv.strip():
        raise ValueError("At least one ISIN is required.")

    return validate_isin_list([item.strip() for item in isin_csv.split(",")], max_items)


def validate_isin_list(isins: Sequence[str], max_items: int = 50) -> List[str]:
    """Validate a sequence of ISIN values and enforce maximum size."""
    if not isins:
        raise ValueError("At least one ISIN is required.")

    cleaned = [isin for isin in isins if isinstance(isin, str) and isin.strip()]
    if not cleaned:
        raise ValueError("At least one ISIN is required.")

    if len(cleaned) > max_items:
        raise ValueError(f"Maximum {max_items} ISINs are allowed per request.")

    invalid = [isin.strip() for isin in cleaned if not is_valid_isin(isin.strip())]
    if invalid:
        raise ValueError(
            "Invalid ISIN values: "
            + ", ".join(invalid)
            + ". Expected 12 uppercase alphanumeric characters."
        )

    return [isin.strip() for isin in cleaned]
