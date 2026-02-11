
# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies (needed for some python packages like asyncpg build if no wheel)
# libpq-dev is often needed for postgres
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Copy the root level modules if they are needed by backend
# Since the backend code imports from "backend.api...", we need to structure it correctly.
# However, the Docker context will likely be the backend folder if we are not careful.
# Ideally, we build from the root context.
# Let's assume the build context is the PROJECT ROOT.
# So we copy "backend" to "/app/backend" and other needed root files.

# ADJUSTMENT:
# If I build from root:
# COPY backend/requirements.txt .
# COPY backend /app/backend
# COPY models.py /app/models.py 
# etc.

# Let's stick to building from the root context in docker-compose.
# So this Dockerfile will assuming it's running from root context is tricky if the file is in backend/.
# Standard pattern: Dockerfile in root, or docker-compose specifies context: . and dockerfile: backend/Dockerfile.

# Let's write this Dockerfile assuming the build context is the PROJECT ROOT.
# This makes it easier to include shared files if any.
# Actually, looking at the code, imports are `from backend.api...`.
# So inside the container, we want the folder structure:
# /app/backend/...
# /app/main.py (if used)

# Re-evaluating based on typical python structure.
# The user runs `python backend/main.py` from root?
# Or `uvicorn backend.api.main:app` from root.
# Yes, `sys.path` fixes I made suggest running from root.

# So, inside container:
# WORKDIR /app
# COPY . /app
# CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]

# BUT, we want to copy only necessary files.
# So:
# COPY backend /app/backend
# COPY requirements.txt (wait, it's in backend/requirements.txt)

# Let's refine the Dockerfile to be placed in `backend/` but expected to be built from root?
# No, usually docker-compose `context: .` and `dockerfile: backend/Dockerfile`.
# In that case, `COPY requirements.txt .` will fail if it looks for it in root.
# It should be `COPY backend/requirements.txt .`

# Let's Write it assuming context is Project Root.

FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend /app/backend
# Copy root level files if referenced (models.py was referenced in persistence_service imports?)
# "from models import FirewallConfig" -> implies models.py is in root? 
# Let's check the file list again. Yes, models.py is in root.
COPY models.py /app/models.py
# Copy other necessary folders if needed (generators, parsers, etc)
COPY generators /app/generators
COPY parsers /app/parsers
COPY convert /app/convert
COPY analyzers /app/analyzers
COPY download /app/download

# Set python path to /app so imports work
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8001

# Run the application
CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8001", "--reload"]
