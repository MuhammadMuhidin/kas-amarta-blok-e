FROM node:20-alpine

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=$BUILD_VERSION

WORKDIR /app

COPY package*.json ./
RUN npm install --frozen-lockfile

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
