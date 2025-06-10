# KITcal - Calendar Management App

A calendar management application built with React Native (Expo) and Django.

## Prerequisites

- Python 3.x
- Node.js and npm
- Make (usually pre-installed on macOS/Linux)

## Quick Start

The project includes a Makefile for easy setup and development. Here are the main commands:

```bash
# First time setup - install all dependencies
make install

# Start the backend server (Django)
make run-backend

# In a new terminal, start the frontend (Expo)
make run-frontend
```

## Available Make Commands

- `make help` - Show all available commands
- `make install` - Install all dependencies (frontend & backend)
- `make setup-backend` - Set up Python virtual environment and install backend dependencies
- `make setup-frontend` - Install frontend dependencies
- `make run-backend` - Start Django development server
- `make run-frontend` - Start Expo development server
- `make clean` - Remove virtual environment and node_modules
- `make migrate` - Run Django database migrations

## Manual Setup (if not using Make)

### Backend Setup

1. Create a Python virtual environment:

   ```bash
   python3 -m venv backendVenv
   ```

2. Activate the virtual environment:

   ```bash
   source backendVenv/bin/activate  # On Unix/macOS
   backendVenv\Scripts\activate     # On Windows
   ```

3. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Run migrations:

   ```bash
   cd djangoproject
   python manage.py migrate
   ```

5. Start the Django server:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

1. Install Node.js dependencies:

   ```bash
   npm install
   ```

2. Start the Expo development server:
   ```bash
   npm start
   ```

## Development

The application consists of two main parts:

1. **Frontend**: React Native application using Expo

   - Located in the `app/` directory
   - Uses Expo Router for navigation
   - Modern UI with responsive design

2. **Backend**: Django REST API
   - Located in the `djangoproject/` directory
   - Handles user authentication
   - Manages calendar data
