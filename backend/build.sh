#!/usr/bin/env bash

# Only run apt-get commands on Linux (Render)
if [ "$(uname)" = "Linux" ]; then
  echo "Running on Linux, installing Chromium..."
  # Install Chrome for Puppeteer
  apt-get update
  apt-get install -y chromium
  echo "Installed Chromium browser"

  # Log Chrome/Chromium paths
  echo "Checking Chrome/Chromium paths:"
  which chromium
  which google-chrome
  which chromium-browser

  # Log directory permissions
  echo "Directory permissions:"
  ls -la /usr/bin/chromium* || echo "No chromium executables found"
else
  echo "Not running on Linux, skipping Chromium installation"
fi

# Install Node.js dependencies
npm install 