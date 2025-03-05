# Use Node.js 18 as the base image
FROM node:18-slim

# Install Chrome dependencies and Chrome
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome-keyring.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY backend/ ./

# Set environment variables
ENV NODE_ENV=production
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV PORT=8080

# Expose the port (Cloud Run requires port 8080)
EXPOSE 8080

# Start with the test server first
CMD ["node", "test-server.js"] 