from pydantic import BaseModel
from typing import Optional, List, Sequence
from datetime import date
from sqlmodel import Session, select
from app.models.models import Scheme


class SchemeDTO(BaseModel):
    id: int
    isin: str
    amfi_code: Optional[str]
    name: str
    type: str
    latest_nav: Optional[float]
    latest_nav_date: Optional[date]


def get_scheme_by_id(session: Session, scheme_id: int) -> Optional[SchemeDTO]:
    scheme = session.get(Scheme, scheme_id)
    if not scheme:
        return None
    return SchemeDTO.model_validate(scheme, from_attributes=True)


def get_schemes_by_ids(session: Session, scheme_ids: List[int]) -> List[SchemeDTO]:
    if not scheme_ids:
        return []
    schemes = session.exec(select(Scheme).where(Scheme.id.in_(scheme_ids))).all()
    return [SchemeDTO.model_validate(s, from_attributes=True) for s in schemes]


def get_scheme_by_isin(session: Session, isin: str) -> Optional[SchemeDTO]:
    scheme = session.exec(select(Scheme).where(Scheme.isin == isin)).first()
    if not scheme:
        return None
    return SchemeDTO.model_validate(scheme, from_attributes=True)
