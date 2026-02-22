import hashlib
from datetime import date
import decimal


def generate_id(
    pan: str, isin: str, date_obj: date, amount: float, type_str: str, units: float
) -> str:
    # Mimic current implementation
    raw = f"{pan}|{isin}|{date_obj.isoformat()}|{amount}|{type_str}|{units}"
    return hashlib.sha256(raw.encode()).hexdigest(), raw


def test_hash_stability():
    pan = "ABCDE1234F"
    isin = "INF123456789"
    d = date(2025, 1, 1)
    type_str = "PURCHASE"

    # Case 1: Float from string
    amount1 = float("100.50")
    units1 = float("10.000")

    # Case 2: Float literal
    amount2 = 100.5
    units2 = 10.0

    # Case 3: High precision float
    amount3 = float("100.5000000000001")
    units3 = float("10.0000000000001")

    hash1, raw1 = generate_id(pan, isin, d, amount1, type_str, units1)
    hash2, raw2 = generate_id(pan, isin, d, amount2, type_str, units2)
    hash3, raw3 = generate_id(pan, isin, d, amount3, type_str, units3)

    print(f"1. Raw: '{raw1}' -> Hash: {hash1}")
    print(f"2. Raw: '{raw2}' -> Hash: {hash2}")
    print(f"3. Raw: '{raw3}' -> Hash: {hash3}")

    if hash1 != hash2:
        print("FAIL: Hash 1 and 2 mismatch (Float Formatting)")
    else:
        print("PASS: Hash 1 and 2 match")


if __name__ == "__main__":
    test_hash_stability()
