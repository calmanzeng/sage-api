FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=3456
EXPOSE 3456
CMD ["node", "sage-api-server.js"]
