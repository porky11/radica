#!/bin/bash
# Start the Freenet node, then the attester; when either stops the container stops, and CapRover restarts it.
freenet network &
node src/main.js &
wait -n
exit 1
