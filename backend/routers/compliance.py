import os
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.connection import get_db
from backend.db.models import ComplianceFiling, ConjunctionEvent, Satellite
from backend.services.compliance_generator import generate_compliance_brief, compile_pdf_document

router = APIRouter(prefix="/api/compliance", tags=["compliance"])

class ComplianceFileRequest(BaseModel):
    event_id: str = Field(..., description="ID of the conjunction event to file for")
    operator_name: str = Field(..., description="Name of the operator submitting the filing")

@router.post("/file", status_code=status.HTTP_201_CREATED)
async def file_collision_avoidance_maneuver(
    request: ComplianceFileRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Submits a collision avoidance maneuver filing for a conjunction event.
    Fetches the hazard parameters, generates the briefing text using Llama,
    compiles a PDF document on the server, and inserts a ComplianceFiling record.
    """
    # 1. Parse and validate the event ID
    try:
        conj_id = int(request.event_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Conjunction event ID must be an integer."
        )

    # 2. Fetch the conjunction event details
    conj_query = select(ConjunctionEvent).filter_by(id=conj_id)
    conj_res = await db.execute(conj_query)
    conj = conj_res.scalar_one_or_none()
    if not conj:
        raise HTTPException(
            status_code=404,
            detail=f"Conjunction event with ID {conj_id} not found."
        )

    # 3. Resolve satellite names for the briefing
    primary_query = select(Satellite).filter_by(norad_id=conj.primary_norad)
    primary_res = await db.execute(primary_query)
    primary = primary_res.scalar_one_or_none()
    primary_name = primary.name if primary else f"NORAD {conj.primary_norad}"
    
    secondary_query = select(Satellite).filter_by(norad_id=conj.secondary_norad)
    secondary_res = await db.execute(secondary_query)
    secondary = secondary_res.scalar_one_or_none()
    secondary_name = secondary.name if secondary else f"NORAD {conj.secondary_norad}"

    # 4. Generate briefing text (Ollama with fallback template)
    event_data = {
        "primary_norad": conj.primary_norad,
        "primary_name": primary_name,
        "secondary_norad": conj.secondary_norad,
        "secondary_name": secondary_name,
        "tca": conj.tca.isoformat(),
        "miss_distance": conj.miss_distance,
        "pc": conj.pc,
        "operator_name": request.operator_name
    }
    
    briefing = generate_compliance_brief(event_data)

    # 5. Insert ComplianceFiling record to get ID
    submitted_time = datetime.now(timezone.utc).replace(tzinfo=None)
    filing = ComplianceFiling(
        operator=request.operator_name,
        satellite=primary_name,
        tca=conj.tca.replace(tzinfo=None),
        form_data={
            "primary_norad": conj.primary_norad,
            "secondary_norad": conj.secondary_norad,
            "miss_distance": conj.miss_distance,
            "pc": conj.pc,
            "briefing": briefing
        },
        pdf_path="PENDING",  # Will update after compilation
        status="Filed",
        submitted_at=submitted_time
    )
    
    db.add(filing)
    await db.flush()  # Flushes session to assign ID

    # 6. Compile PDF Document
    filing_data = {
        "id": filing.id,
        "satellite": primary_name,
        "primary_norad": conj.primary_norad,
        "secondary_norad": conj.secondary_norad,
        "operator": request.operator_name,
        "tca": conj.tca,
        "status": filing.status,
        "submitted_at": filing.submitted_at,
        "briefing": briefing
    }
    
    try:
        pdf_path = compile_pdf_document(filing_data)
        filing.pdf_path = pdf_path
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Filing failed during PDF compilation: {e}"
        )

    return {
        "id": filing.id,
        "operator": filing.operator,
        "satellite": filing.satellite,
        "tca": filing.tca,
        "form_data": filing.form_data,
        "pdf_path": filing.pdf_path,
        "status": filing.status,
        "submitted_at": filing.submitted_at
    }

@router.get("")
async def get_compliance_filings(
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieves all submitted compliance filings.
    """
    query = select(ComplianceFiling).order_by(ComplianceFiling.submitted_at.desc())
    result = await db.execute(query)
    filings = result.scalars().all()
    return [
        {
            "id": f.id,
            "operator": f.operator,
            "satellite": f.satellite,
            "tca": f.tca,
            "status": f.status,
            "submitted_at": f.submitted_at,
            "pdf_path": f.pdf_path
        }
        for f in filings
    ]

@router.get("/download/{filing_id}")
async def download_compliance_filing(
    filing_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Downloads the official print-ready PDF filing for an INSPACE-CAM-2026 submission.
    """
    filing_query = select(ComplianceFiling).filter_by(id=filing_id)
    filing_res = await db.execute(filing_query)
    filing = filing_res.scalar_one_or_none()
    
    if not filing:
        raise HTTPException(
            status_code=404,
            detail=f"Compliance filing record with ID {filing_id} not found."
        )
        
    if not filing.pdf_path or filing.pdf_path == "PENDING" or not os.path.exists(filing.pdf_path):
        raise HTTPException(
            status_code=404,
            detail="The compiled PDF file is not present on the server storage."
        )

    return FileResponse(
        path=filing.pdf_path,
        media_type="application/pdf",
        filename=f"INSPACE-CAM-2026-Filing-{filing.id}.pdf"
    )
