### Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files first to install deps
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci --silent

# Copy the frontend source and build
COPY frontend/ frontend/
RUN cd frontend && npm run build

### Production stage - nginx
FROM nginx:stable-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
