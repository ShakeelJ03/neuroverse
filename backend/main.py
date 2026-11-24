"""NEUROVERSE computational service (skeleton).

Not used by the current web build: all simulation runs client-side. This service is the
planned home for heavier work: converting atlas NIfTI labels to GLB meshes, serving real
NIfTI datasets with provenance metadata, and future MRE inversion / tractography demos.

Run:  pip install -r requirements.txt  &&  uvicorn main:app --reload --port 8000
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NEUROVERSE compute", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["GET"], allow_headers=["*"])

DATA_DIR = Path(__file__).parent / "data"


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/datasets")
def datasets() -> list[dict]:
    """List locally installed datasets. Each must ship a provenance.json
    ({name, source_url, licence, attribution, kind: clinical|atlas|synthetic}) next to its volumes."""
    out = []
    if DATA_DIR.exists():
        for d in sorted(p for p in DATA_DIR.iterdir() if p.is_dir()):
            prov = d / "provenance.json"
            out.append({"id": d.name, "has_provenance": prov.exists()})
    return out


@app.post("/meshes/from-labels")
def meshes_from_labels() -> None:
    """Planned: label NIfTI → per-label surfaces (marching cubes via scikit-image) → GLB (trimesh)."""
    raise HTTPException(status_code=501, detail="Not implemented yet — see README 'Replacing the anatomical model'.")
