FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Environment variables
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
