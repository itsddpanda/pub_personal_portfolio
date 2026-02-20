from sqlmodel import Session, select, func, case
from app.models.models import Transaction, Scheme, Portfolio, Folio
from pyxirr import xirr
from datetime import date
from typing import List, Dict, Any
from collections import defaultdict

def get_portfolio_summary(session: Session, user_id: str):
    """
    Calculates Portfolio XIRR and Total Value using SQL aggregations for performance.
    """
    # 1. Fetch Net Units per Scheme using SQL Aggregation
    # Logic: Sum units (Positive for Purchase, Negative for Redemption)
    # Note: casparser typically gives positive units for both, so we use transaction type logic.
    
    # Define which types reduce units
    REDEMPTION_TYPES = ["REDEMPTION", "SWITCH_OUT", "STP_OUT", "SWP"]
    
    # Query for holdings: Scheme + Net Units
    # We join folio -> portfolio to filter by user_id
    holdings_query = (
        select(
            Scheme,
            func.sum(
                func.abs(Transaction.units) * 
                case(
                    (Transaction.type.in_(REDEMPTION_TYPES), -1),
                    else_=1
                )
            ).label("net_units"),
            func.sum(
                case(
                    (Transaction.type.notin_(REDEMPTION_TYPES), Transaction.amount),
                    else_=0
                )
            ).label("total_invested") # Simple sum of inflows
        )
        .join(Transaction, Transaction.scheme_id == Scheme.id)
        .join(Folio, Transaction.folio_id == Folio.id)
        .join(Portfolio, Folio.portfolio_id == Portfolio.id)
        .where(Portfolio.user_id == user_id)
        .group_by(Scheme.id)
    )
    
    results = session.exec(holdings_query).all()
    
    if not results:
        return {"total_value": 0, "invested_value": 0, "xirr": 0, "holdings": []}

    processed_holdings = []
    total_current_value = 0.0
    total_invested_value = 0.0

    for scheme, net_units, invested_sum in results:
        if net_units < 0.001:
            continue
            
        nav = scheme.latest_nav if scheme.latest_nav else 0.0
        current_val = net_units * nav
        
        total_current_value += current_val
        total_invested_value += invested_sum
        
        processed_holdings.append({
            "scheme_name": scheme.name,
            "isin": scheme.isin,
            "units": float(net_units),
            "current_nav": nav,
            "current_value": current_val,
            "invested_value": float(invested_sum)
        })

    # 2. Fetch Transactions for XIRR & FIFO Cost Basis
    # We need: date, amount, type, units, nav, scheme_id
    
    txn_query = (
        select(Transaction)
        .join(Folio, Transaction.folio_id == Folio.id)
        .join(Portfolio, Folio.portfolio_id == Portfolio.id)
        .where(Portfolio.user_id == user_id)
        .order_by(Transaction.date) # FIFO requires chronological order
    )
    
    txns = session.exec(txn_query).all()
    
    # FIFO Queues: scheme_id -> List of {units, cost_per_unit}
    fifo_queues = defaultdict(list)
    estimated_schemes = set()  # Track schemes with zero-cost OPENING_BALANCE
    opening_balance_details = {}  # scheme_id -> {units, date}
    
    # XIRR Cash Flows
    dates = []
    amounts = []
    total_stamp_duty = 0.0
    
    inflow_types = ["PURCHASE", "PURCHASE_SIP", "SIP", "SWITCH_IN", "STP_IN", "OPENING_BALANCE"]
    outflow_types = ["REDEMPTION", "SWITCH_OUT", "STP_OUT", "SWP"]
    
    for t in txns:
        t_type = t.type.upper()
        
        # Track stamp duty
        if "STAMP_DUTY" in t_type:
            total_stamp_duty += abs(t.amount) if t.amount else 0
            continue
        
        # --- FIFO Logic ---
        # Only track schemes that are in our holdings list (optimization? No, need all history)
        
        if any(x in t_type for x in inflow_types):
            # Add to queue
            # Cost per unit = Amount / Units (Should match NAV usually, but Amount is source of truth)
            if t.units and t.units > 0:
                cost_per_unit = t.amount / t.units
                fifo_queues[t.scheme_id].append({
                    "units": t.units,
                    "cost_per_unit": cost_per_unit
                })
                if cost_per_unit == 0 and "OPENING_BALANCE" in t_type:
                    estimated_schemes.add(t.scheme_id)
                    opening_balance_details[t.scheme_id] = {
                        "units": float(t.units),
                        "date": t.date.isoformat() if t.date else None
                    }
        
        elif any(x in t_type for x in outflow_types):
            # Remove from queue (First In, First Out)
            units_to_redeem = abs(t.units) if t.units else 0
            
            # Scheme queue
            queue = fifo_queues[t.scheme_id]
            
            while units_to_redeem > 0.0001 and queue:
                batch = queue[0]
                if batch["units"] > units_to_redeem:
                    # Partial removal from this batch
                    batch["units"] -= units_to_redeem
                    units_to_redeem = 0
                else:
                    # Exhaust this batch
                    units_to_redeem -= batch["units"]
                    queue.pop(0)
                    
        # --- XIRR Logic ---
        cash_flow = 0.0
        
        if any(x in t_type for x in inflow_types):
            cash_flow = -abs(t.amount)
        elif any(x in t_type for x in (outflow_types + ["DIVIDEND"])):
            cash_flow = abs(t.amount)
            
        if cash_flow != 0:
            dates.append(t.date)
            amounts.append(cash_flow)

    # 3. Calculate Final Invested Value from FIFO Queues
    total_invested_value = 0.0
    scheme_invested_map = defaultdict(float)
    
    for scheme_id, queue in fifo_queues.items():
        invested = sum(b["units"] * b["cost_per_unit"] for b in queue)
        scheme_invested_map[scheme_id] = invested
        total_invested_value += invested

    # 4. Integrate with Processed Holdings
    # processed_holdings already has current_value from SQL aggregation
    # We update the invested_value from our FIFO calculation
    
    final_holdings = []
    for h in processed_holdings:
        # Match by scheme ID? 
        # Wait, processed_holdings is a list of dicts, I don't have scheme_id easily unless I check ISIN or add it.
        # Let's verify what processed_holdings has.
        # It has "isin". I can map scheme_id -> isin from the SQL query earlier.
        # Or better: Update processed_holdings loop to include scheme_id.
        pass # Handle in next step if needed, but wait:
        
    # Re-map holdings to inject invested_value
    final_holdings = []
    latest_nav_date = None
    
    for scheme, net_units, _old_invested_sum in results:
        if net_units < 0.001:
            continue
            
        nav = scheme.latest_nav if scheme.latest_nav else 0.0
        current_val = net_units * nav
        
        # Track max NAV date among active holdings
        if scheme.latest_nav_date:
            if not latest_nav_date or scheme.latest_nav_date > latest_nav_date:
                latest_nav_date = scheme.latest_nav_date
        
        fifo_invested = scheme_invested_map.get(scheme.id, 0.0)
        
        holding_entry = {
            "scheme_name": scheme.name,
            "isin": scheme.isin,
            "units": float(net_units),
            "current_nav": nav,
            "current_value": current_val,
            "invested_value": float(fifo_invested),
            "is_estimated": scheme.id in estimated_schemes
        }
        
        if scheme.id in estimated_schemes:
            ob = opening_balance_details.get(scheme.id, {})
            holding_entry["opening_balance_units"] = ob.get("units", 0)
            holding_entry["opening_balance_date"] = ob.get("date")
            holding_entry["purchased_units"] = float(net_units) - ob.get("units", 0)
            holding_entry["purchased_invested"] = float(fifo_invested)
        
        final_holdings.append(holding_entry)

    # Add terminal value for XIRR
    if total_current_value > 0:
        dates.append(date.today())
        amounts.append(total_current_value)

    # Calculate XIRR
    try:
        if not dates:
            xirr_val = 0.0
        else:
            xirr_val = xirr(dates, amounts)
            if xirr_val is None:
                xirr_val = 0.0
    except Exception as e:
        print(f"XIRR Error: {e}")
        xirr_val = 0.0
        
    return {
        "total_value": total_current_value,
        "invested_value": total_invested_value,
        "xirr": xirr_val * 100 if xirr_val else 0.0, # Percentage
        "latest_nav_date": latest_nav_date.isoformat() if latest_nav_date else None,
        "holdings": final_holdings,
        "has_estimated_holdings": len(estimated_schemes) > 0,
        "estimated_schemes_count": len(estimated_schemes),
        "total_stamp_duty": round(total_stamp_duty, 2)
    }
