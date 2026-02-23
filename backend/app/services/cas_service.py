import casparser
import io
import os
import tempfile
import traceback
import hashlib
import re
import json
from datetime import datetime
from uuid import UUID
from typing import Dict, Any, Optional
from sqlmodel import Session, select
from fastapi import HTTPException
from app.models.models import User, Portfolio, Folio, Scheme, Transaction, AMC

# Load ISIN Map
ISIN_MAP = {}
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ISIN_MAP_PATH = os.path.join(BASE_DIR, "data", "isin_amfi_map.json")

# Fallback for Docker container path if BASE_DIR logic doesn't align with mount
if not os.path.exists(ISIN_MAP_PATH):
    if os.path.exists("/data/isin_amfi_map.json"):
        ISIN_MAP_PATH = "/data/isin_amfi_map.json"
    elif os.path.exists("./data/isin_amfi_map.json"):
        ISIN_MAP_PATH = "./data/isin_amfi_map.json"

try:
    if os.path.exists(ISIN_MAP_PATH):
        with open(ISIN_MAP_PATH, "r") as f:
            ISIN_MAP = json.load(f)
    else:
        print(f"Warning: ISIN map not found at {ISIN_MAP_PATH}")
except Exception as e:
    print(f"Warning: Failed to load ISIN map: {e}")


def process_cas_data(
    session: Session, content: bytes, password: str, x_user_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Parses CAS PDF content and saves data to the database.
    """

    # 1. Parse PDF
    data = None
    with io.BytesIO(content) as f:
        try:
            data = casparser.read_cas_pdf(f, password)
        except casparser.exceptions.CASParseError as e:
            raise HTTPException(
                status_code=400, detail=f"Failed to parse CAS: {str(e)}"
            )
        except casparser.exceptions.IncorrectPasswordError:
            raise HTTPException(status_code=401, detail="Incorrect password.")
        except Exception as e:
            print(f"BytesIO parse failed: {e}, retrying with temp file...")
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                data = casparser.read_cas_pdf(tmp_path, password)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

    if not data:
        raise HTTPException(
            status_code=400, detail="Failed to extract data from CAS PDF."
        )

    # 1.5 Debug Schema Dump
    try:
        # Determine the best path depending on Docker vs standalone vs tests
        schema_dump_dir = (
            "/data" if os.path.exists("/data") else os.path.join(BASE_DIR, "data")
        )
        os.makedirs(schema_dump_dir, exist_ok=True)

        # Serialize datetime and decimal objects safely
        from datetime import date as _date, datetime as _datetime
        from decimal import Decimal as _Decimal

        def _json_serial(obj):
            if isinstance(obj, (_datetime, _date)):
                return obj.isoformat()
            if isinstance(obj, _Decimal):
                return float(obj)
            raise TypeError(f"Type {type(obj)} not serializable")

        schema_path = os.path.join(schema_dump_dir, "cas_schema.json")
        with open(schema_path, "w") as f:
            json.dump(data, f, indent=2, default=_json_serial)
    except Exception as e:
        print(f"Warning: Failed to write CAS debug schema dump: {e}")
        pass  # Do not fail the entire upload process

    # 2. Extract Investor Info
    # Validation: Ensure CAS Type is DETAILED
    cas_type = data.get("cas_type", "UNKNOWN")
    if cas_type != "DETAILED":
        return {
            "status": "error",
            "message": "Select Summary Type as Detailed (Includes transaction listing) for your Consolidate Account Statement. Current statement type is not supported",
            "code": "INVALID_CAS_TYPE",
        }

    investor_info = data.get("investor_info", {})
    name = investor_info.get("name")
    full_pan = None

    # Find PAN from investor_info or first folio
    full_pan = investor_info.get("pan")

    if not full_pan or full_pan == "N/A":
        folios = data.get("folios", [])
        if not folios:
            return {
                "status": "success",
                "message": "No folios found in CAS",
                "data": data,
            }

        for folio in folios:
            if folio.get("PAN"):
                full_pan = folio.get("PAN")
                break

    if not full_pan:
        raise HTTPException(status_code=400, detail="Could not retrieve PAN from CAS.")

    # 3. Validation: PAN Mismatch with Active User
    if x_user_id:
        try:
            active_user_uuid = UUID(x_user_id)
            active_user = session.get(User, active_user_uuid)
            if active_user and active_user.pan != full_pan:
                print(
                    f"DEBUG: PAN Mismatch! Active: '{active_user.pan}' ({active_user.name}) vs Detected: '{full_pan}' ({name})"
                )
                return {
                    "status": "warning",
                    "message": "PAN Mismatch Detected",
                    "code": "PAN_MISMATCH",
                    "detected_pan": full_pan,
                    "detected_name": name,
                    "active_user_pan": active_user.pan,
                    "active_user_name": active_user.name,
                }
        except ValueError:
            pass  # Invalid UUID header, ignore

    # 4. Get or Create User
    user = session.exec(select(User).where(User.pan == full_pan)).first()
    if not user:
        user = User(pan=full_pan, name=name)
        session.add(user)
        session.commit()
        session.refresh(user)

    # 5. Get or Create Portfolio (Default)
    portfolio = session.exec(
        select(Portfolio).where(Portfolio.user_id == user.id)
    ).first()
    if not portfolio:
        portfolio = Portfolio(user_id=user.id, name="Main Portfolio")
        session.add(portfolio)
        session.commit()
        session.refresh(portfolio)

    new_txns_count = 0
    reconciled_count = 0
    skipped_txns_count = 0

    # --- DEBUG DUMP START ---
    debug_data = {
        "user": {"name": user.name, "pan": user.pan},
        "portfolio_id": portfolio.id,
        "folios": [],
    }
    # --- DEBUG DUMP END ---

    # 6. Process Folios & Schemes
    for folio_data in folios:
        folio_num = folio_data.get("folio")

        # Get or Create Folio
        folio_obj = session.exec(
            select(Folio).where(
                Folio.portfolio_id == portfolio.id, Folio.folio_number == folio_num
            )
        ).first()

        if not folio_obj:
            folio_obj = Folio(portfolio_id=portfolio.id, folio_number=folio_num)
            session.add(folio_obj)
            session.commit()
            session.refresh(folio_obj)

        folio_debug = {"folio": folio_num, "schemes": []}  # DEBUG

        # 4. Process Schemes
        for scheme_data in folio_data.get("schemes", []):
            isin = scheme_data.get("isin")
            amfi = scheme_data.get("amfi")
            scheme_name_raw = scheme_data.get("scheme", "")

            # Fallback: Extract ISIN from raw name if missing
            if not isin and scheme_name_raw:
                match = re.search(r"ISIN:\s*([A-Z0-9]{12})", scheme_name_raw)
                if match:
                    isin = match.group(1)
                else:
                    # If we still don't have ISIN, we can't process this scheme
                    print(
                        f"Warning: Skipping scheme '{scheme_name_raw}' - ISIN not found."
                    )
                    continue

            # Requirement 1: Strip ISIN suffix if present for display/storage
            scheme_name = re.sub(r"\s*-\s*ISIN:\s*[A-Z0-9\s]+", "", scheme_name_raw).strip()

            # Lookup AMFI Code if missing
            if not amfi and isin:
                amfi = ISIN_MAP.get(isin)

            # Extract and Normalize AMC Name
            raw_amc = folio_data.get("amc", "").strip()
            amc_obj = None

            if raw_amc:
                norm_name = raw_amc.replace("Mutual Fund", "").strip()
                amc_obj = session.exec(select(AMC).where(AMC.name == norm_name)).first()
                if not amc_obj:
                    code = norm_name.upper().replace(" ", "_")
                    amc_obj = AMC(name=norm_name, code=code)
                    session.add(amc_obj)
                    session.commit()
                    session.refresh(amc_obj)

            # Check if Scheme Exists
            scheme_obj = session.exec(select(Scheme).where(Scheme.isin == isin)).first()

            # Extract Valuation Data
            val_data = scheme_data.get("valuation", {})
            val_date = None
            val_value = None
            if val_data:
                val_date_raw = val_data.get("date")
                if val_date_raw:
                    if isinstance(val_date_raw, str):
                        try:
                            val_date = datetime.strptime(
                                val_date_raw, "%Y-%m-%d"
                            ).date()
                        except ValueError:
                            pass
                    else:
                        val_date = val_date_raw
                val_value = float(val_data.get("value", 0) or 0)

            # Extract Closing Units
            # Handle both string and float inputs robustly
            # Removed latest_units logic - relying on OPENING_BALANCE txn

            advisor = scheme_data.get("advisor")

            if not scheme_obj:
                scheme_obj = Scheme(
                    isin=isin,
                    name=scheme_name,
                    amfi_code=amfi,
                    type=scheme_data.get("type", "UNKNOWN"),
                    advisor=advisor,
                    amc_id=amc_obj.id if amc_obj else None,
                    valuation_date=val_date,
                    valuation_value=val_value,
                )
                session.add(scheme_obj)
                session.commit()
                session.refresh(scheme_obj)
            else:
                updated = False
                if not scheme_obj.amc_id and amc_obj:
                    scheme_obj.amc_id = amc_obj.id
                    updated = True

                # Update latest valuation snapshot
                if val_date:
                    scheme_obj.valuation_date = val_date
                    scheme_obj.valuation_value = val_value
                    updated = True

                if advisor and not scheme_obj.advisor:
                    scheme_obj.advisor = advisor
                    updated = True

                # Backfill AMFI Code if missing
                if not scheme_obj.amfi_code and amfi:
                    scheme_obj.amfi_code = amfi
                    updated = True

                if updated:
                    session.add(scheme_obj)
                    session.commit()

            scheme_debug = {  # DEBUG
                "scheme": scheme_name,
                "isin": isin,
                "amfi": amfi,
                "amc": amc_obj.name if amc_obj else None,
                "advisor": advisor,
                "units": {
                    "open": scheme_data.get("open"),
                    "close": scheme_data.get("close"),
                },
                "valuation": {"date": val_date, "value": val_value},
                "transactions": [],
            }

            # Synthetic OPENING_BALANCE Transaction
            # If there are opening units, create a transaction to represent them.
            # This ensures they appear in dashboards (which join on Transaction)
            # and that the sum of units matches the closing balance.
            try:
                open_units = float(scheme_data.get("open", 0) or 0)
            except (ValueError, TypeError):
                open_units = 0.0

            if open_units > 0:
                # Determine Date: Start of Statement or Default
                stmt_period = data.get("statement_period", {})
                from_date_str = stmt_period.get("from")
                start_date = None
                if from_date_str:
                    try:
                        # casparser formats usually: 01-Apr-2023 or similar
                        # Try a few common formats or generic parser if needed
                        # But for now assuming standard CAS format
                        start_date = datetime.strptime(from_date_str, "%d-%b-%Y").date()
                    except ValueError:
                        pass

                if not start_date:
                    start_date = datetime(2000, 1, 1).date()

                # Generate Hash
                op_txn_id = Transaction.generate_id(
                    pan=full_pan,
                    isin=isin,
                    date=start_date,
                    amount=0.0,
                    type="OPENING_BALANCE",
                    units=open_units,
                )

                if not session.get(Transaction, op_txn_id):
                    # Check if we already have historical transactions (meaning we have broader history)
                    prior_txns = session.exec(
                        select(Transaction).where(
                            Transaction.scheme_id == scheme_obj.id,
                            Transaction.folio_id == folio_obj.id,
                            Transaction.date < start_date,
                        )
                    ).first()

                    if prior_txns:
                        print(
                            f"Skipping synthetic OPENING_BALANCE for {scheme_obj.name} as prior history exists."
                        )
                        scheme_debug["transactions"].append(
                            {
                                "id": op_txn_id,
                                "date": start_date.isoformat(),
                                "amount": 0.0,
                                "units": open_units,
                                "type": "OPENING_BALANCE",
                                "status": "skipped (prior history exists)",
                            }
                        )
                    else:
                        op_txn = Transaction(
                            id=op_txn_id,
                            folio_id=folio_obj.id,
                            scheme_id=scheme_obj.id,
                            date=start_date,
                            type="OPENING_BALANCE",
                            amount=0.0,
                            units=open_units,
                            nav=0.0,
                            balance=open_units,
                        )
                        session.add(op_txn)
                        new_txns_count += 1

                        scheme_debug["transactions"].append(
                            {
                                "id": op_txn_id,
                                "date": start_date.isoformat(),
                                "amount": 0.0,
                                "units": open_units,
                                "type": "OPENING_BALANCE",
                                "status": "new (synthetic)",
                            }
                        )

            # Process Transactions
            transactions = scheme_data.get("transactions", [])
            min_real_date = None  # Track earliest real txn date

            for txn in transactions:
                date_val = txn.get("date")

                if isinstance(date_val, str):
                    date_obj = datetime.strptime(date_val, "%Y-%m-%d").date()
                else:
                    date_obj = date_val

                if not min_real_date or date_obj < min_real_date:
                    min_real_date = date_obj

                amount = float(txn.get("amount", 0))
                units = float(txn.get("units", 0) or 0)
                nav = float(txn.get("nav", 0) or 0)
                txn_type = txn.get("type")
                balance = float(txn.get("balance", 0) or 0)

                # Generate Hash
                txn_id = Transaction.generate_id(
                    pan=full_pan,
                    isin=isin,
                    date=date_obj,
                    amount=amount,
                    type=txn_type,
                    units=units,
                )

                # Check Deduplication
                existing_txn = session.get(Transaction, txn_id)

                txn_debug_entry = {  # DEBUG
                    "id": txn_id,
                    "date": date_obj.isoformat(),
                    "amount": amount,
                    "units": units,
                    "type": txn_type,
                    "balance": balance,
                    "status": "new",
                }

                if existing_txn:
                    skipped_txns_count += 1
                    txn_debug_entry["status"] = "skipped"  # DEBUG
                    scheme_debug["transactions"].append(txn_debug_entry)  # DEBUG
                    continue

                # Insert New Transaction
                new_txn = Transaction(
                    id=txn_id,
                    folio_id=folio_obj.id,
                    scheme_id=scheme_obj.id,
                    date=date_obj,
                    type=txn_type,
                    amount=amount,
                    units=units,
                    nav=nav,
                    balance=balance,
                )
                session.add(new_txn)
                new_txns_count += 1
                scheme_debug["transactions"].append(txn_debug_entry)  # DEBUG

            # --- RECONCILIATION logic ---
            # If we imported real transactions, check if they "precede" an existing OPENING_BALANCE
            if min_real_date:
                # Find any OPENING_BALANCE for this scheme occurring strictly AFTER min_real_date
                to_delete = session.exec(
                    select(Transaction).where(
                        Transaction.scheme_id == scheme_obj.id,
                        Transaction.folio_id == folio_obj.id,
                        Transaction.type == "OPENING_BALANCE",
                        Transaction.date > min_real_date,
                    )
                ).all()

                if to_delete:
                    reconciled_count += len(to_delete)
                    print(
                        f"RECONCILE: Removing {len(to_delete)} redundant Opening Balances for {scheme_obj.name}"
                    )
                    for d_txn in to_delete:
                        session.delete(d_txn)

            folio_debug["schemes"].append(scheme_debug)  # DEBUG

        debug_data["folios"].append(folio_debug)  # DEBUG

    # 7. Debug Import Schema Dump
    try:
        import_dump_dir = (
            "/data" if os.path.exists("/data") else os.path.join(BASE_DIR, "data")
        )
        os.makedirs(import_dump_dir, exist_ok=True)
        import_path = os.path.join(import_dump_dir, "cas_import.json")

        with open(import_path, "w") as f:
            json.dump(debug_data, f, indent=2, default=str)
    except Exception as e:
        print(f"Warning: Failed to write CAS debug import dump: {e}")
        pass  # Do not fail the entire upload process

    session.commit()

    return {
        "status": "success",
        "user_id": str(user.id),
        "user": user.name,
        "pan": full_pan,
        "new_transactions": new_txns_count,
        "skipped_transactions": skipped_txns_count,
        "reconciled_opening_balances": reconciled_count,
    }
