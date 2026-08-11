#!/bin/bash
#
# Dagelijkse dump van de LogistiekStock-database.
#
# Bewaart 30 dagen. De dumps zijn klein (rond een halve MB gecomprimeerd), dus
# dat kost een kleine 15 MB -- ruim binnen wat er vrij is, ook op een volle
# schijf.
#
# Terugzetten:
#   gunzip -c /opt/backups/logistiek-JJJJMMDD-UUMMSS.sql.gz \
#     | docker compose -f /opt/logistiek-stock/docker-compose.yml exec -T db \
#         psql -U logistiek -d logistiek
set -euo pipefail

BACKUP_DIR=/opt/backups
STAMP=$(date +%Y%m%d-%H%M%S)
DOEL="$BACKUP_DIR/logistiek-$STAMP.sql.gz"

cd /opt/logistiek-stock
docker compose exec -T db pg_dump -U logistiek -d logistiek --clean --if-exists \
  | gzip > "$DOEL"

# Een dump van niets is geen dump: liever nu luid mislukken dan er bij een
# herstel achterkomen dat er maanden een leeg bestand is weggeschreven.
if [ ! -s "$DOEL" ] || ! gunzip -t "$DOEL" 2>/dev/null; then
  echo "backup mislukt: $DOEL is leeg of beschadigd" >&2
  rm -f "$DOEL"
  exit 1
fi

find "$BACKUP_DIR" -name 'logistiek-*.sql.gz' -mtime +30 -delete
echo "$(date '+%F %T') ok $(du -h "$DOEL" | cut -f1) $DOEL"
