import json
from sqlmodel import Session, create_engine, select
from app.models.models import Scheme

# Database URL (Internal Docker path)
sqlite_url = "sqlite:////data/mfa.db"
engine = create_engine(sqlite_url)

# Load Map
try:
    with open("/data/isin_amfi_map.json", "r") as f:
        isin_map = json.load(f)
    print(f"Loaded {len(isin_map)} ISIN mappings.")
except Exception as e:
    print(f"Error loading map: {e}")
    exit(1)


def fix_amfi_codes():
    with Session(engine) as session:
        # potential bug: amfi_code might be None or ""
        schemes = session.exec(select(Scheme)).all()
        updated_count = 0

        for scheme in schemes:
            if not scheme.amfi_code:
                # Try to find match
                amfi = isin_map.get(scheme.isin)
                if amfi:
                    print(f"Updating {scheme.isin} ({scheme.name}) -> AMFI: {amfi}")
                    scheme.amfi_code = amfi
                    session.add(scheme)
                    updated_count += 1
                else:
                    print(f"No mapping found for {scheme.isin}")

        session.commit()
        print(f"Done. Updated {updated_count} schemes.")


if __name__ == "__main__":
    fix_amfi_codes()
