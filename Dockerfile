# Shared, reproducible CPU dependencies for every project target.
FROM python:3.11-slim AS core-deps

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip
RUN python -m pip install --upgrade pip setuptools wheel

# The only Python requirements file that exists at the repository root level is
# web/backend/requirements.txt; requirements-dev.txt extends it via "-r requirements.txt".
COPY web/backend/requirements.txt /app/requirements.txt
RUN pip install -r requirements.txt

# SMPL-capable dependency layer used by the dashboard and export service only.
FROM core-deps AS smpl-deps
COPY requirements-smpl.txt /app/
RUN pip install --index-url https://download.pytorch.org/whl/cpu torch==2.2.2+cpu \
    && pip install -r requirements-smpl.txt \
    && pip install --no-build-isolation chumpy==0.70

FROM smpl-deps AS dashboard
COPY . /app

# Create non-root user
RUN useradd -m appuser || true
USER appuser

ENV PATH="/home/appuser/.local/bin:${PATH}"

EXPOSE 5000 8888

CMD ["python", "app.py"]

# Notebook training excludes Torch, SMPL, PyVista, and other dashboard-only weight.
FROM core-deps AS training
# requirements-dev.txt starts with "-r requirements.txt"; copying the backend
# requirements to /app/requirements.txt satisfies that relative include.
COPY requirements-dev.txt web/backend/requirements.txt /app/
RUN pip install -r requirements-dev.txt
COPY . /app
RUN useradd -m appuser || true
USER appuser
ENV PATH="/home/appuser/.local/bin:${PATH}"
EXPOSE 8888
CMD ["jupyter", "lab", "--ip=0.0.0.0", "--port=8888", "--no-browser"]

FROM dashboard AS smpl-runtime
CMD ["python", "-m", "src.export_smpl", "--bmi", "30", "--risk", "65", "--out", "artifacts_notebook/digital_twin.glb"]
