import requests
import json
import os
import sys

# Define paths relative to the script
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "isin_amfi_map.json")
AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"


def recover():
    print(f"Fetching latest AMFI data from {AMFI_URL}...")
    try:
        response = requests.get(AMFI_URL, timeout=30)
        response.raise_for_status()
        lines = response.text.splitlines()
        print(f"Received {len(lines)} lines.")
    except Exception as e:
        print(f"Error fetching AMFI data: {e}")
        return

    isin_map = {}
    for line in lines:
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 6:
            continue

        amfi_code = parts[0].strip()
        isin1 = parts[1].strip()
        isin2 = parts[2].strip()

        if not amfi_code.isdigit():
            continue

        if isin1 and isin1 != "-":
            isin_map[isin1] = amfi_code
        if isin2 and isin2 != "-":
            isin_map[isin2] = amfi_code

    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(isin_map, f, indent=2)

    print(f"Successfully recovered {OUTPUT_FILE} with {len(isin_map)} mappings.")


if __name__ == "__main__":
    recover()
