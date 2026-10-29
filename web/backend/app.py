"""Smart Diabetes Digital Twin and Personalised Health Management Platform.
Flask REST API Backend for ShanghaiT2DM Longitudinal Cohort.
Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
"""
from __future__ import annotations

import os
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from flask import Flask, jsonify, request, send_from_directory, g
try:
    from flask_cors import CORS
except ImportError:
    CORS = None

from auth import APP_ROLES, patient_is_assigned, request_access_token, require_auth

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

from forecast_routes import forecast_api
from services.clinical_knowledge_graph_service import (
    ClinicalKnowledgeGraphUnavailableError,
    get_clinical_knowledge_graph,
)
from models.training.supabase_io import SupabaseStorageError
from services.patient_assignment_service import (
    PatientAssignmentUnavailableError,
    get_doctor_assigned_patient_ids,
)
from services.knowledge_graph_analysis_service import (
    KnowledgeGraphAnalysisUnavailableError,
    analyze_patient_knowledge_graph,
)


app = Flask(__name__)
app.register_blueprint(forecast_api)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

@app.errorhandler(SupabaseStorageError)
def clinical_data_unavailable(error):
    return jsonify(error=str(error), source='supabase'), 503

@app.before_request
def authorize_api_request():
    if not request.path.startswith("/api/patients"):
        return None
    response = require_auth(APP_ROLES)(lambda: None)()
    if response is not None:
        return response
    user = getattr(g, "current_user", {})
    patient_id = request.view_args.get("patient_id") if request.view_args else None
    if request.endpoint == "forecast_api.glucose_forecast":
        if user.get("role") != "doctor":
            return jsonify({"error": "Glucose prediction is available to Doctor accounts only."}), 403
        if not patient_id:
            return jsonify({"error": "A patient record is required for a glucose forecast."}), 403
        try:
            assigned = patient_is_assigned(user.get("id", ""), patient_id, request_access_token() or "")
        except RuntimeError:
            return jsonify({"error": "This patient's care-team assignment could not be verified. Please try again later."}), 503
        if not assigned:
            return jsonify({"error": "This patient is not assigned to your care team."}), 403
    if user.get("role") == "patient" and not patient_id:
        return jsonify({"error": "Patients cannot browse the patient directory."}), 403
    if patient_id and user.get("role") == "patient" and user.get("claims", {}).get("patient_id") != patient_id:
        return jsonify({"error": "Patients may only access their own records."}), 403
    # These older services generate illustrative profiles, timelines and scores.
    # Keep them inaccessible rather than returning fabricated clinical results.
    if request.endpoint in {'patient_timeline', 'patient_risk', 'patient_xai', 'patient_insights',
                            'patient_digital_twin', 'patient_simulate', 'patient_report'}:
        return jsonify(error='This prototype endpoint does not provide validated clinical results. Use the recorded-data workspace or the glucose-forecast endpoint.', available=False), 501
    return None

if CORS is not None:
    allowed_origins = [o.strip().rstrip("/") for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if o.strip()]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins}})

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Frontend static distribution path (for single-server production deployment on Render)
DIST_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"


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
    """Return heuristic linear factor attributions (not SHAP) for predicted risk."""
    custom_features = request.get_json(silent=True) if request.method == "POST" else None
    result = explain_patient_risk(patient_id, custom_features=custom_features)
    return jsonify(result)


# --------------------------------------------------------------------------
# Personal Health Knowledge Graph Endpoints (Module 5)
# --------------------------------------------------------------------------

@app.route("/api/patients/<patient_id>/knowledge-graph", methods=["GET", "POST"])
def patient_knowledge_graph(patient_id: str):
    """Return the selected patient's recorded diabetes and condition graph."""
    payload = request.get_json(silent=True) if request.method == "POST" else {}
    if payload is None:
        payload = {}
    if not isinstance(payload, dict) or (payload.get("patient") is not None and not isinstance(payload["patient"], dict)):
        return jsonify({"error": "Provide a JSON object with an optional patient object."}), 400
    if getattr(g, "current_user", {}).get("role") == "doctor":
        denial = _verify_doctor_patient_assignment(patient_id)
        if denial is not None:
            return denial
    try:
        graph = get_patient_knowledge_graph(patient_id, patient_payload=payload.get("patient"))
        return jsonify(graph)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except RuntimeError as exc:
        app.logger.warning("Patient KG unavailable: %s", exc)
        return jsonify({"error": str(exc)}), 503


# --------------------------------------------------------------------------
# Read-only Clinical Knowledge Graph (Doctor workspace)
# --------------------------------------------------------------------------

@app.route("/api/doctor/knowledge-graph", methods=["GET"])
@require_auth(frozenset({"doctor"}))
def doctor_clinical_knowledge_graph():
    """Return the shared clinical concept graph from Neo4j Aura (read-only)."""
    try:
        return jsonify(get_clinical_knowledge_graph())
    except ClinicalKnowledgeGraphUnavailableError as exc:
        app.logger.warning("Clinical KG unavailable: %s", exc)
        return jsonify({"error": str(exc), "source": "neo4j-aura"}), 503

def _verify_doctor_patient_assignment(patient_id: str):
    """Fail closed unless the current doctor has this patient assigned."""
    user = getattr(g, "current_user", {}) or {}
    token = getattr(g, "access_token", None)
    if not token:
        return jsonify({"error": "Authentication required."}), 401
    try:
        assigned_ids = get_doctor_assigned_patient_ids(str(user.get("id") or ""), token)
    except PatientAssignmentUnavailableError as exc:
        app.logger.warning("Doctor patient assignments unavailable: %s", type(exc).__name__)
        return jsonify({"error": "Assigned patient access could not be verified. Check the Supabase assignment table and policies."}), 503
    if str(patient_id) not in assigned_ids:
        return jsonify({"error": "This patient is not assigned to your doctor account."}), 403
    return None


@app.route("/api/doctor/assigned-patients", methods=["GET"])
@require_auth(frozenset({"doctor"}))
def doctor_assigned_patients():
    """List only patient IDs assigned to the authenticated doctor."""
    user = getattr(g, "current_user", {}) or {}
    token = getattr(g, "access_token", None)
    if not token:
        return jsonify({"error": "Authentication required."}), 401
    try:
        patient_ids = get_doctor_assigned_patient_ids(str(user.get("id") or ""), token)
    except PatientAssignmentUnavailableError as exc:
        app.logger.warning("Doctor patient assignments unavailable: %s", type(exc).__name__)
        return jsonify({"error": "Assigned patient access could not be verified. Check the Supabase assignment table and policies."}), 503
    return jsonify({"patient_ids": patient_ids, "count": len(patient_ids)})


@app.route("/api/doctor/patients/<patient_id>/knowledge-graph", methods=["GET"])
@require_auth(frozenset({"doctor"}))
def doctor_patient_knowledge_graph(patient_id: str):
    """Return the selected patient's condition graph after assignment validation."""
    denial = _verify_doctor_patient_assignment(patient_id)
    if denial is not None:
        return denial
    try:
        return jsonify(get_patient_knowledge_graph(patient_id))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except RuntimeError as exc:
        app.logger.warning("Patient KG unavailable: %s", type(exc).__name__)
        return jsonify({"error": str(exc)}), 503


@app.route("/api/doctor/patients/<patient_id>/knowledge-graph/analysis", methods=["POST"])
@require_auth(frozenset({"doctor"}))
def doctor_patient_knowledge_graph_analysis(patient_id: str):
    """Interpret the selected patient's knowledge graph using reviewed graph evidence."""
    denial = _verify_doctor_patient_assignment(patient_id)
    if denial is not None:
        return denial
    try:
        graph = get_patient_knowledge_graph(patient_id)
        analysis = analyze_patient_knowledge_graph(graph)
        analysis["patientId"] = patient_id
        return jsonify(analysis)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except KnowledgeGraphAnalysisUnavailableError as exc:
        app.logger.warning("KG analysis unavailable: %s", type(exc).__name__)
        return jsonify({"error": str(exc)}), 503
    except RuntimeError as exc:
        app.logger.warning("Patient KG analysis unavailable: %s", type(exc).__name__)
        return jsonify({"error": str(exc)}), 503


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
    if request.method == "POST" and custom_features:
        validated_features, warnings = validate_biomarkers(custom_features)
        if warnings:
            return jsonify({"message": "Input validation warnings for digital twin", "warnings": warnings, "data": validated_features}), 400
        custom_features = validated_features

    twin_state = get_digital_twin_state(patient_id, custom_features=custom_features)
    return jsonify(twin_state)


# --------------------------------------------------------------------------
# What-If Scenario Simulation Endpoints (Module 8)
# --------------------------------------------------------------------------

def validate_biomarkers(data: dict) -> tuple[dict, list[str]]:
    if not isinstance(data, dict):
        return {}, ["Request body must be a JSON object."]
    warnings = []
    ranges = {"glucose_value": (20, 600, "Glucose", "mg/dL"), "glucose": (20, 600, "Glucose", "mg/dL"), "hba1c_value": (4, 20, "HbA1c", "%"), "hba1c": (4, 20, "HbA1c", "%"), "fbg_value": (20, 600, "Fasting Blood Glucose", "mg/dL"), "fasting_glucose": (20, 600, "Fasting Blood Glucose", "mg/dL"), "bmi_value": (10, 70, "BMI", "kg/m^2"), "bmi": (10, 70, "BMI", "kg/m^2"), "systolic_bp": (70, 200, "Systolic Blood Pressure", "mmHg"), "diastolic_bp": (40, 120, "Diastolic Blood Pressure", "mmHg"), "egfr": (0, 200, "eGFR", "mL/min/1.73m^2")}
    for field, value in data.items():
        if field not in ranges:
            continue
        minimum, maximum, label, unit = ranges[field]
        try:
            number = float(value)
        except (TypeError, ValueError):
            warnings.append({"field": field, "flag": "not_numeric", "message": f"{label} must be numeric."})
            continue
        if not math.isfinite(number):
            warnings.append({"field": field, "flag": "not_finite", "message": f"{label} must be finite."})
        elif not minimum <= number <= maximum:
            warnings.append({"field": field, "flag": "out_of_range", "message": f"{label} {value} {unit} is outside the plausible range ({minimum}-{maximum} {unit})."})
    return data.copy(), warnings

@app.route("/api/patients/<patient_id>/simulate", methods=["POST"])
def patient_simulate(patient_id: str):
    """Simulate counterfactual interventions and compute outcome deltas."""
    payload = request.get_json(silent=True) or {}
    validated_payload, warnings = validate_biomarkers(payload)
    if warnings:
        # You can choose to return an error, or just include warnings in the response
        # For now, let's include them in the response.
        return jsonify({"message": "Input validation warnings", "warnings": warnings, "data": validated_payload}), 400
    simulation_result = simulate_what_if(patient_id, scenario_deltas=validated_payload)
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


