# Use Node.js 18 as the base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy only the minimal server file
COPY backend/minimal.js ./

# Set environment variables
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the minimal server
CMD ["node", "minimal.js"] 