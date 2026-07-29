#!/usr/bin/env bash
# Render build script for the Django backend.
# Installs dependencies, collects static files, and applies migrations.
set -o errexit

pip install -r requirements.txt

cd djangoproject
python manage.py collectstatic --no-input
python manage.py migrate
