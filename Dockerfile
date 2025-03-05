# Use Node.js 18 as the base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install only Express
RUN npm install express

# Copy the minimal Express server file
COPY backend/express-minimal.js ./

# Set environment variables
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the minimal Express server
CMD ["node", "express-minimal.js"] 