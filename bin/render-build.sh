# Render.com Build Script
# This runs during Render's build step before starting the app.
set -o errexit

bundle install
