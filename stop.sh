#!/usr/bin/env bash

# Simple script to stop the backend and frontend dev servers started by start.sh

if [ -f .dev_pids ]; then
  while read -r pid; do
    kill "$pid" 2>/dev/null || true
  done < .dev_pids
  rm -f .dev_pids
  echo "Stopped all dev servers"
else
  echo "No running dev servers found"
fi