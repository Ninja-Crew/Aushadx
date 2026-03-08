FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ENV PORT=3002
EXPOSE 3002

CMD ["npm", "start"]
