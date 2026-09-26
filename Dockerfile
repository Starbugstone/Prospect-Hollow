FROM node:24-bookworm-slim AS frontend
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY . .
RUN node scripts/export-public-content.mjs && npm run build

FROM php:8.4-apache-bookworm AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev libicu-dev unzip \
    && docker-php-ext-install pdo_pgsql pdo_mysql intl pcntl \
    && a2enmod rewrite headers && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /var/www/app
COPY backend/ ./
RUN composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
COPY --from=frontend /build/backend/content/ ./content/
COPY --from=frontend /build/dist/ ./public/
COPY deploy/apache.conf /etc/apache2/sites-available/000-default.conf
COPY deploy/php.ini /usr/local/etc/php/conf.d/production.ini
RUN mkdir -p var && chown -R www-data:www-data var
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s CMD php bin/health.php
