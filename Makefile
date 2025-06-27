# Variables
PYTHON = python3
VENV = backendVenv
PIP = $(VENV)/bin/pip
PYTHON_VENV = $(VENV)/bin/python
NPM = npm

# Colors for terminal output
CYAN = \033[0;36m
GREEN = \033[0;32m
YELLOW = \033[0;33m
NC = \033[0m # No Color

.PHONY: help install run-backend run-frontend setup-backend setup-frontend clean

# Default target
help:
	@echo "$(CYAN)KITcal Development Commands:$(NC)"
	@echo "$(GREEN)make install$(NC)        - Install all dependencies (frontend & backend)"
	@echo "$(GREEN)make setup-backend$(NC)  - Set up Python virtual environment and install backend dependencies"
	@echo "$(GREEN)make setup-frontend$(NC) - Install frontend dependencies"
	@echo "$(GREEN)make run-backend$(NC)    - Start Django development server"
	@echo "$(GREEN)make run-frontend$(NC)   - Start Expo development server"
	@echo "$(GREEN)make clean$(NC)          - Remove virtual environment and node_modules"
	@echo "$(GREEN)make migrate$(NC)        - Run Django database migrations"
	@echo "$(YELLOW)Note: Run 'make install' first time setup$(NC)"

# Install all dependencies
install: setup-backend setup-frontend

# Backend setup
setup-backend:
	@echo "$(CYAN)Setting up Python virtual environment...$(NC)"
	$(PYTHON) -m venv $(VENV)
	@echo "$(CYAN)Installing backend dependencies...$(NC)"
	$(PIP) install -r requirements.txt

# Frontend setup
setup-frontend:
	@echo "$(CYAN)Installing frontend dependencies...$(NC)"
	$(NPM) install

# Run backend server
run-backend:
	@echo "Starting Django development server... "
	cd djangoproject && ../backendVenv/bin/python manage.py runserver 0.0.0.0:8000

# Run frontend development server
run-frontend:
	@echo "$(CYAN)Starting Expo development server...$(NC)"
	$(NPM) run start

# Clean up
clean:
	@echo "$(CYAN)Cleaning up...$(NC)"
	rm -rf $(VENV)
	rm -rf node_modules

# Database migrations
migrate:
	@echo "$(CYAN)Running database migrations...$(NC)"
	cd djangoproject && ../$(PYTHON_VENV) manage.py migrate 