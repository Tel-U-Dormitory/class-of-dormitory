#!/bin/sh
set -eu

# Named volumes may be empty on their first use. Never run migrations implicitly.
mkdir -p storage/app/private storage/app/public storage/framework/cache/data \
    storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
if [ "$(id -u)" = 0 ]; then
    chown www-data:www-data storage storage/app storage/app/private storage/app/public \
        storage/framework storage/framework/cache storage/framework/cache/data \
        storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
fi
php artisan config:cache
php artisan view:cache
exec docker-php-entrypoint "$@"
