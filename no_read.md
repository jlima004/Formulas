Para fazer o deploy de uma aplicação Node.js (em TypeScript) com MySQL e Redis na DigitalOcean usando docker-compose, o caminho mais indicado é utilizar um Droplet.

Embora a DigitalOcean possua a "App Platform", ela é mais voltada para apps sem estado (stateless). Para um cenário onde você gerencia seus próprios containers de banco de dados via Compose, o Droplet oferece o controle necessário.

Here is the complete step-by-step guide to deploying your Node.js (TypeScript) application with MySQL, Redis, and SSL on a DigitalOcean Droplet.

1. Local Project Preparation
   Ensure your project is structured to handle the TypeScript build and the Nginx configuration.

A. Dockerfile (Multi-stage for TypeScript)
Create a Dockerfile in your root directory:

# Build Stage

FROM node:20-alpine AS builder
WORKDIR /app
COPY package\*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage

FROM node:20-alpine
WORKDIR /app
COPY package\*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]

B. Nginx Configuration
Create a folder named nginx and inside it a conf folder. Create nginx/conf/app.conf:

server {
listen 80;
server_name yourdomain.com; # Replace with your domain

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }

}

server {
listen 443 ssl;
server_name yourdomain.com; # Replace with your domain

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

}

O Gemini disse
Here is the complete step-by-step guide to deploying your Node.js (TypeScript) application with MySQL, Redis, and SSL on a DigitalOcean Droplet.

1. Local Project Preparation
   Ensure your project is structured to handle the TypeScript build and the Nginx configuration.

A. Dockerfile (Multi-stage for TypeScript)
Create a Dockerfile in your root directory:

Dockerfile

# Build Stage

FROM node:20-alpine AS builder
WORKDIR /app
COPY package\*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage

FROM node:20-alpine
WORKDIR /app
COPY package\*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
B. Nginx Configuration
Create a folder named nginx and inside it a conf folder. Create nginx/conf/app.conf:

Nginx
server {
listen 80;
server_name yourdomain.com; # Replace with your domain

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }

}

server {
listen 443 ssl;
server_name yourdomain.com; # Replace with your domain

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

}

C. docker-compose.yml
services:
app:
build: .
expose: - "3000"
env_file: .env
depends_on: - db - cache

nginx:
image: nginx:alpine
ports: - "80:80" - "443:443"
volumes: - ./nginx/conf:/etc/nginx/conf.d - ./certbot/conf:/etc/letsencrypt - ./certbot/www:/var/www/certbot
depends_on: - app

certbot:
image: certbot/certbot
volumes: - ./certbot/conf:/etc/letsencrypt - ./certbot/www:/var/www/certbot
entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

db:
image: mysql:8.0
restart: always
environment:
MYSQL_DATABASE: my_db
MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
volumes: - db_data:/var/lib/mysql

cache:
image: redis:7-alpine
restart: always
volumes: - cache_data:/data

volumes:
db_data:
cache_data:

O Gemini disse
Here is the complete step-by-step guide to deploying your Node.js (TypeScript) application with MySQL, Redis, and SSL on a DigitalOcean Droplet.

1. Local Project Preparation
   Ensure your project is structured to handle the TypeScript build and the Nginx configuration.

A. Dockerfile (Multi-stage for TypeScript)
Create a Dockerfile in your root directory:

Dockerfile

# Build Stage

FROM node:20-alpine AS builder
WORKDIR /app
COPY package\*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage

FROM node:20-alpine
WORKDIR /app
COPY package\*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
B. Nginx Configuration
Create a folder named nginx and inside it a conf folder. Create nginx/conf/app.conf:

Nginx
server {
listen 80;
server_name yourdomain.com; # Replace with your domain

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }

}

server {
listen 443 ssl;
server_name yourdomain.com; # Replace with your domain

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

}
C. docker-compose.yml
YAML
services:
app:
build: .
expose: - "3000"
env_file: .env
depends_on: - db - cache

nginx:
image: nginx:alpine
ports: - "80:80" - "443:443"
volumes: - ./nginx/conf:/etc/nginx/conf.d - ./certbot/conf:/etc/letsencrypt - ./certbot/www:/var/www/certbot
depends_on: - app

certbot:
image: certbot/certbot
volumes: - ./certbot/conf:/etc/letsencrypt - ./certbot/www:/var/www/certbot
entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

db:
image: mysql:8.0
restart: always
environment:
MYSQL_DATABASE: my_db
MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
volumes: - db_data:/var/lib/mysql

cache:
image: redis:7-alpine
restart: always
volumes: - cache_data:/data

volumes:
db_data:
cache_data:

2. Setting up the DigitalOcean Droplet
   1. Create Droplet: Choose the Marketplace tab and select the Docker image (Ubuntu with Docker pre-installed).

   2. Specs: Select at least 2GB RAM (essential for running MySQL and Redis together).

   3. Firewall: In the Networking tab, create a Firewall allowing ports 22 (SSH), 80 (HTTP), and 443 (HTTPS).

3. Deployment and SSL Activation
   Connect to your droplet via SSH: ssh root@your_droplet_ip.

A. Initial Setup 1. Clone your repo and enter the directory.

    2. Create your .env file with nano .env.

    3. Crucial Step: Temporarily comment out the listen 443 block in nginx/conf/app.conf if you don't have certificates yet.

B. Generate SSL Certificate
Run the containers and request the certificate:

docker compose up -d
docker compose run --rm certbot certonly --webroot --webroot-path=/var/www/certbot -d yourdomain.com

C. Finalize Nginx
Uncomment the SSL block in nginx/conf/app.conf.

Restart Nginx to apply changes:
docker compose restart nginx

Best Practices
Persistent Data: The volumes in the YAML ensure your database and cache survive container restarts.

Security: Never expose ports 3306 or 6379 in the ports section of the YAML; keep them internal to the Docker network.
