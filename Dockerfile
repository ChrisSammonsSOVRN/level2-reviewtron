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

# Install dependencies
RUN npm install express cors pg puppeteer-core

# Create logs directory
RUN mkdir -p logs

# Copy the server files
COPY backend/full-server.js ./
COPY backend/db-setup.js ./

# Set environment variables
ENV PORT=8080
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Start the full server
CMD ["node", "full-server.js"] 