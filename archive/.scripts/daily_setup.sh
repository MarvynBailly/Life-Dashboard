#!/bin/bash

echo "=================================================="
echo "Starting Life OS Morning Routine: $(date)"
echo "=================================================="

# Move to the correct directory so relative paths in Julia work
cd /home/pi/Life/.scripts

# Run the scripts using the full path to Julia
/home/pi/.juliaup/bin/julia new_day.jl
/home/pi/.juliaup/bin/julia migrate_todos.jl

echo "Finished at: $(date)"
echo ""