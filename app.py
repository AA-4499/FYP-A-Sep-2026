"""Smart Diabetes Digital Twin and Personalised Health Management Platform.
Flask REST API Backend for ShanghaiT2DM Longitudinal Cohort.
Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
"""
from __future__ import annotations

import os
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
try:
    from flask_cors import CORS
except ImportError:
    CORS = None

from services import (
    list_patients,
    get_patient,
    get_default_patient_id,
    get_patient_timeline,
    assess_patient_risk,
    explain_patient_risk,
    get_patient_knowledge_graph,
    generate_patient_insights,
    get_digital_twin_state,
    simulate_what_if,
    generate_patient_report,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

if CORS is not None:
    CORS(app, resources={r"/api/*": {"origins": "*"}})

# Frontend static distribution path (for single-server production deployment on Render)
DIST_DIR = Path(__file__).resolve().parent / "frontend" / "dist"


# --------------------------------------------------------------------------
# System & Metadata Endpoints
# --------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint for Render/Vercel monitoring."""
    return jsonify({
        "status": "healthy",
        "platform": "Smart Diabetes Digital Twin",
        "dataset": "ShanghaiT2DM Longitudinal Cohort",
        "institution": "Swinburne University of Technology Sarawak",
        "supervisor": "Ts. Dr. Vong Wan Tze",
        "version": "2.0.0",
    })


@app.route("/api/meta", methods=["GET"])
def meta():
    """Platform metadata and default state."""
    default_id = get_default_patient_id()
    return jsonify({
        "default_patient_id": default_id,
        "supported_dataset": "ShanghaiT2DM",
        "total_cohort_size": 105,
        "workflow_steps": [
            "Select Patient",
            "View Health History (Longitudinal CGM)",
            "Assess Current Risk",
            "Understand Key Factors (XAI)",
            "Explore Personalised Insights",
            "View Digital Twin (Multi-Organ)",
            "Create What-If Scenario",
            "Compare Simulated Outcomes",
            "Generate Clinical Report"
        ],
    })


# --------------------------------------------------------------------------
# Patient Management Endpoints (Module 1)
# --------------------------------------------------------------------------

@app.route("/api/patients", methods=["GET"])
def get_patients_list():
    """Fetch paginated patient records with optional search query filter."""
    query = request.args.get("query", "").strip()
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 12))
    result = list_patients(query=query, page=page, per_page=per_page)
    return jsonify(result)


@app.route("/api/patients/<patient_id>", methods=["GET"])
def get_patient_profile(patient_id: str):
    """Fetch demographic & clinical profile for a specific patient."""
    patient = get_patient(patient_id)
    if not patient:
        return jsonify({"error": f"Patient #{patient_id} not found."}), 404
    return jsonify(patient)


# --------------------------------------------------------------------------
# Longitudinal Health Monitoring Endpoints (Module 2)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/timeline", methods=["GET"])
def patient_timeline(patient_id: str):
    """Retrieve 14-day CGM readings, diurnal glycemic profile, and visit history."""
    timeline = get_patient_timeline(patient_id)
    return jsonify(timeline)


# --------------------------------------------------------------------------
# Longitudinal Risk Assessment Endpoints (Module 3)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/risk-assessment", methods=["GET", "POST"])
def patient_risk(patient_id: str):
    """Evaluate multi-dimensional complication risk scores."""
    custom_features = request.get_json(silent=True) if request.method == "POST" else None
    result = assess_patient_risk(patient_id, custom_features=custom_features)
    return jsonify(result)


# --------------------------------------------------------------------------
# Explainable AI (XAI) Endpoints (Module 4)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/xai-explanation", methods=["GET", "POST"])
def patient_xai(patient_id: str):
    """Compute patient-specific SHAP attribution values for predicted risk."""
    custom_features = request.get_json(silent=True) if request.method == "POST" else None
    result = explain_patient_risk(patient_id, custom_features=custom_features)
    return jsonify(result)


# --------------------------------------------------------------------------
# Personal Health Knowledge Graph Endpoints (Module 5)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/knowledge-graph", methods=["GET", "POST"])
def patient_knowledge_graph(patient_id: str):
    """Generate Cytoscape.js ontology graph nodes and edges for the patient."""
    graph = get_patient_knowledge_graph(patient_id)
    return jsonify(graph)


# --------------------------------------------------------------------------
# Trend Detection & Personalised Insights Endpoints (Module 6)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/insights", methods=["GET", "POST"])
def patient_insights(patient_id: str):
    """Synthesize personalised clinical insights and lifestyle recommendations."""
    custom_features = request.get_json(silent=True) if request.method == "POST" else None
    insights = generate_patient_insights(patient_id, custom_features=custom_features)
    return jsonify(insights)


# --------------------------------------------------------------------------
# Digital Twin State Endpoints (Module 7)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/digital-twin", methods=["GET", "POST"])
def patient_digital_twin(patient_id: str):
    """Obtain multi-organ physiological status and 3D avatar descriptors."""
    custom_features = request.get_json(silent=True) if request.method == "POST" else None
    twin_state = get_digital_twin_state(patient_id, custom_features=custom_features)
    return jsonify(twin_state)


# --------------------------------------------------------------------------
# What-If Scenario Simulation Endpoints (Module 8)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/simulate", methods=["POST"])
def patient_simulate(patient_id: str):
    """Simulate counterfactual interventions and compute outcome deltas."""
    payload = request.get_json(silent=True) or {}
    simulation_result = simulate_what_if(patient_id, scenario_deltas=payload)
    return jsonify(simulation_result)


# --------------------------------------------------------------------------
# Consolidated Clinical Reporting Endpoints (Module 9)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/report", methods=["GET"])
def patient_report(patient_id: str):
    """Compile comprehensive clinical summary report for printing or export."""
    report = generate_patient_report(patient_id)
    return jsonify(report)


# --------------------------------------------------------------------------
# Static Assets & SPA Fallback for Single-Server Deployments
# --------------------------------------------------------------------------

@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_spa(path: str):
    """Serve compiled React SPA from frontend/dist if present, else show API info."""
    if DIST_DIR.exists():
        target_file = DIST_DIR / path
        if path and target_file.exists():
            return send_from_directory(DIST_DIR, path)
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({
        "message": "Smart Diabetes Digital Twin API backend is running.",
        "api_docs": "/api/meta",
        "health": "/api/health",
        "frontend": "Run 'npm run dev' inside the frontend directory, or build with 'npm run build'."
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
