FROM node:20-slim

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist/ ./dist/

# git identity required for commits
RUN git config --global user.email "pawlog@container" && \
    git config --global user.name "Pawlog"

ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/server/entry.mjs"]
