FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# 在 Railway 环境下 iztro 直接在 node_modules 里
ENV ZIWEI_DIR=/app
EXPOSE 3456
CMD ["node", "sage-api-server.js"]
