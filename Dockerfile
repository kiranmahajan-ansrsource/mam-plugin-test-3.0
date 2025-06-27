FROM node:18
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY . .
# Expose port (Cloud Run uses 8080 by default)
ENV PORT=8080
# Start the application
CMD ["node", "index.js"]
