FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install

COPY src ./src

ENV MCP_DATA_DIR=/app/data
RUN mkdir -p /app/data

CMD ["node", "src/index.mjs"]
