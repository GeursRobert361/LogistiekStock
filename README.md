# LogistiekStock

Mobiele PWA voor het tellen en bijvullen van voorraden in kiosken van de **Johan Cruijff ArenA**.

## Doel

Na een evenement worden alle actieve kiosken geteld. Per kiosk voert een medewerker in hoeveel er van ieder product aanwezig is. De app berekent automatisch hoeveel er bij moet worden gevuld. Vervolgens worden vulrondes gepland en uitgevoerd.

---

## Technische architectuur

```
src/
  app/              # Next.js App Router pages
  components/       # Herbruikbare UI-componenten
  features/         # Feature-specifieke logica
  domain/           # Pure bedrijfslogica (geen I/O)
    counting/       # Restockberekening (kwartregels, 80%-regel)
    routing/        # Circulaire kioskroutes
    restocking/     # Vulplanning
  repositories/     # Data-laag in de browser (demo | http)
    interfaces/     # Repository-interfaces
    demo/           # Demo-implementatie (localStorage, geen database nodig)
    http/           # Productie: praat met /api/rpc, nooit rechtstreeks met de db
  server/           # Alles wat alleen op de server draait
    api/            # Welke methode bij welke rol hoort (default deny)
    auth/           # Wachtwoorden (bcrypt) en sessies
    db/             # Postgres-pool en rij ↔ object-vertalingen
    repositories/   # De echte queries
  services/         # Toepassingslogica boven de repositories
    countingService.ts        # Tellen: lokaal schrijven, server via de outbox
    countSessionService.ts    # Telronde: status, review, goedkeuren
    restockPlanningService.ts # Vulrondes samenstellen en reserveren
    deliveryService.ts        # Afleveren per kiosk
    syncService.ts            # Outbox richting server
  lib/
    quarterUnits.ts # Quarter-unit hulpfuncties
    permissions.ts  # Rechten per rol en per pad
    db/offlineDb.ts # IndexedDB via Dexie
    seed/           # Demodata
  types/            # TypeScript-typen en enums
```

### Lokaal eerst, server erachteraan

Tijdens het tellen is IndexedDB de bron van waarheid: iedere wijziging gaat er
zonder vertraging in. De server volgt via een outbox, die bij verbindingsverlies
blijft staan en later opnieuw probeert. Daardoor kan een telling niet verloren
gaan doordat iemand direct doorloopt naar de volgende kiosk of de app sluit.

De demo-modus heeft geen server: de Demo-repositories schrijven naar
localStorage en gedragen zich verder als een echte backend.

### Rekenprincipe: kwart-eenheden

Hoeveelheden worden intern opgeslagen als **integer quarter units** (1 verpakking = 4 QU).  
Dit voorkomt floating-point fouten bij vergelijkingen met 0,25-stappen.

### 80%-regel (halve verpakking)

Bij een geteld aantal met `.50` fractie geldt:
- `floor(geteld) <= 80% van norm` → halve verpakking telt als 0 (HALF_DOWN)
- `floor(geteld) > 80% van norm`  → halve verpakking telt als 1 (HALF_UP)

Zie `src/domain/counting/calculateRestock.ts` en de uitgebreide tests in `__tests__/`.

---

## Lokaal installeren

```bash
git clone <repo>
cd LogistiekStock
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. De app start automatisch in **demo-modus**: geen
database nodig.

---

## Omgevingsvariabelen

| Variabele | Beschrijving | Standaard |
|-----------|-------------|-----------|
| `NEXT_PUBLIC_APP_MODE` | `demo` of `production` | `demo` |
| `NEXT_PUBLIC_APP_URL` | Publieke URL van de app | `http://localhost:3000` |
| `DATABASE_URL` | Postgres-verbinding (alleen `production`) | — |
| `SESSION_SECRET` | Ondertekent de sessies (alleen `production`) | — |

`DATABASE_URL` en `SESSION_SECRET` zijn geheim en hebben bewust **geen**
`NEXT_PUBLIC_`-prefix: alles met dat voorvoegsel wordt in de browserbundle
ingebakken en is daarmee openbaar. Wie een `NEXT_PUBLIC_`-waarde wijzigt moet
opnieuw bouwen — herstarten is niet genoeg.

---

## Demo-modus

In demo-modus draait de app volledig lokaal zonder database. De
demo-repositories schrijven naar localStorage (de gesimuleerde server) en de
offline-opslag zit in IndexedDB. Een refresh raakt dus niets kwijt.

Via **Beheer → Instellingen → Demo terugzetten** zet je alles terug naar de
begintoestand.

**Demo-accounts** (wachtwoord: `demo1234`):

| Account | Rol |
|---------|-----|
| `admin@demo.nl` | Admin |
| `planner@demo.nl` | Planner |
| `teller1@demo.nl` | Teller |
| `vuller1@demo.nl` | Vuller |

---

## Productie: Postgres op de eigen server

De productiemodus praat niet vanuit de browser met de database. De browser kent
alleen `/api/rpc`; die endpoint kijkt de rol van de ingelogde gebruiker na tegen
een expliciete lijst van toegestane methoden (`src/server/api/methodPermissions.ts`)
en weigert al het overige. Daardoor zijn er geen databasegegevens in de browser
nodig — en staan ze er dus ook niet.

1. Zet `.env.local` (staat in `.gitignore` en wordt nooit meegecommit):
   ```
   NEXT_PUBLIC_APP_MODE=production
   DATABASE_URL=postgres://logistiek:<wachtwoord>@localhost:5432/logistiek
   SESSION_SECRET=<openssl rand -base64 32>
   ```
2. Voer de migraties uit:
   ```bash
   npm run db:migrate
   ```
   Het script houdt in `schema_migrations` bij wat er al gedraaid is en zet elke
   migratie in een transactie; opnieuw draaien is veilig.
3. Vul de database met stamdata:
   ```bash
   npm run seed              # ringen, kiosken, categorieën, producten, normen
   npm run seed -- --users   # plus de demo-accounts (alleen voor test/acceptatie)
   ```
   Ook dit script is idempotent: opnieuw draaien werkt bestaande rijen bij in
   plaats van dubbele aan te maken.
4. Optioneel, om de vullijst te kunnen bekijken zonder echt te tellen:
   ```bash
   npm run seed:testcount            # fictieve telling over de eerste ring
   npm run seed:testcount -- --remove
   ```

Wachtwoorden staan als bcrypt-hash in de database en sessies in de tabel
`sessions` — daarvan wordt alleen de SHA-256 van het token bewaard, in een
httpOnly-cookie. Een gestolen databasedump levert dus geen bruikbare sessies op.

---

## Tests uitvoeren

```bash
# Unit tests (Vitest)
npm run test:run

# Unit tests met watch
npm run test

# E2E tests (Playwright) — bouwt en start zelf een productieserver, want de
# service worker draait niet in development
npm run test:e2e

# TypeScript typecheck
npm run typecheck
```

---

## PWA installeren

1. Open de app in Chrome op Android of Safari op iOS
2. Kies "Voeg toe aan beginscherm" / "Installeer app"
3. De app werkt daarna als zelfstandige app, ook offline

---

## Deployment

De app draait op `root@5.181.134.106` op poort **3003**, reverse proxied via Nginx naar `https://stock.niettegeloven.com`.

De app en de database draaien als twee containers uit `docker-compose.yml`. De
database heeft bewust géén poort naar buiten: alleen de app komt erbij, over het
interne Docker-netwerk.

### Eerste deployment

```bash
ssh root@5.181.134.106
git clone <repo> /opt/logistiek-stock
cd /opt/logistiek-stock

# Geheimen: genereer ze op de server, lees ze niet voor en plak ze nergens.
umask 077
{
  echo "NEXT_PUBLIC_APP_MODE=production"
  echo "NEXT_PUBLIC_APP_URL=https://stock.niettegeloven.com"
  echo "POSTGRES_USER=logistiek"
  echo "POSTGRES_DB=logistiek"
  echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
  echo "SESSION_SECRET=$(openssl rand -base64 32)"
} > .env

cp nginx/stock.niettegeloven.com.conf /etc/nginx/sites-available/stock.niettegeloven.com
ln -s /etc/nginx/sites-available/stock.niettegeloven.com /etc/nginx/sites-enabled/
# Moet mee: de vhost gebruikt een limit_req_zone, en die hoort in het
# http-blok. Zonder dit bestand start nginx niet.
cp nginx/logistiek-limits.conf /etc/nginx/conf.d/
nginx -t && systemctl reload nginx
certbot --nginx -d stock.niettegeloven.com

docker compose up -d --build
```

### Backups

De database staat in een Docker-volume; zonder dump is er geen kopie. Het script
draait dagelijks om 04:00 en bewaart 30 dagen:

```bash
install -m 755 scripts/backup.sh /opt/backups/backup.sh
( crontab -l 2>/dev/null; \
  echo "0 4 * * * /opt/backups/backup.sh >> /var/log/logistiek-backup.log 2>&1" ) | crontab -
```

Terugzetten, en dat is het enige wat een backup bewijst:

```bash
gunzip -c /opt/backups/logistiek-JJJJMMDD-UUMMSS.sql.gz \
  | docker compose exec -T db psql -U logistiek -d logistiek
```

### Updates deployen

Een deploy brengt **alleen code** naar productie. Schema en stamdata volgen niet
vanzelf mee — dat is met opzet, want anders zou elke deploy wijzigingen
terugzetten die iemand bewust in Beheer heeft gemaakt. Drie soorten wijziging,
drie handelingen:

| Wijziging | Wat je doet |
| --- | --- |
| Alleen code | herbouwen |
| Nieuwe migratie | herbouwen, daarna migraties draaien |
| Stamdata (normen, kiosken, catalogus) | herbouwen, daarna de gerichte sync |

**Alleen code:**

```bash
git push
ssh root@5.181.134.106 "cd /opt/logistiek-stock && git pull && docker compose up -d --build"
```

**Stamdata van de tweede ring bijwerken.** Draai `npm run seed` hier níet voor:
die synchroniseert veel meer dan deze set en zet daarbij handmatige wijzigingen
terug. Gebruik de gerichte sync, die standaard alleen laat zien wat hij zou doen:

```bash
# 1. Controleer dat er een verse backup is
ssh root@5.181.134.106 "/opt/backups/backup.sh"

# 2. Code bijwerken
ssh root@5.181.134.106 "cd /opt/logistiek-stock && git pull && docker compose up -d --build"

# 3. Migraties, als er nieuwe bij zitten (zie hieronder)

# 4. Proefdraai: leest alleen, wijzigt niets
#    (zelfde wegwerpcontainer als bij migraties, met het sync-script)
npx tsx scripts/syncSecondRingMasterData.ts

# 5. Lees de uitvoer na. Klopt het aantal gewijzigde en uitgeschakelde normen?

# 6. Pas dan uitvoeren, in één transactie
npx tsx scripts/syncSecondRingMasterData.ts --apply
```

Stap 6 controleert zichzelf achteraf: hij leest de database opnieuw en vergelijkt
de drankmatrix, de bekernormen en de opslagtypes met de stamdata. Daar hoort ook
bij dat een bekerformaat dat een locatie niet meer voert géén actieve norm heeft.
Klopt er iets niet, dan eindigt het script met een foutcode.

De sync raakt uitsluitend de locaties waarvoor een echte lijst is aangeleverd.
Eerste ring, evenementen, tellingen, bijvulbehoeften, leveringen, gebruikers en
agenda blijven ongemoeid.

### Migraties en seeds op de server

Op de server staat geen `node_modules` — die zit in het image. Draai
scripts daarom in een wegwerp-container op het netwerk van de compose-stack,
zodat `db` bereikbaar is:

```bash
cd /opt/logistiek-stock
docker run --rm -v /opt/logistiek-stock:/app -w /app \
  --network logistiek-stock_default --env-file /opt/logistiek-stock/.env \
  node:22-alpine sh -c '
    export DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@db:5432/$POSTGRES_DB"
    npm ci --no-audit --no-fund && npx tsx scripts/migrate.ts
  '
```

Vervang het laatste script door wat je nodig hebt:

- `scripts/syncSecondRingMasterData.ts` — de tweede-ringstamdata bijwerken.
  Standaard een proefdraai; pas met `--apply` voert hij iets uit. **Dit is wat
  je in productie wilt** wanneer normen of kiosken zijn gewijzigd.
- `scripts/seedTestCount.ts` — een testtelling klaarzetten.
- `scripts/seedDb.ts` — de volledige stamdata. Bedoeld voor een lege database.
  Op een draaiende productiedatabase is dit te grof: hij raakt ook de eerste
  ring, de agenda en alle normen, en zet daarmee handmatige wijzigingen terug.
  Draai hem daar alleen bewust, nooit als vast onderdeel van een deploy.

---

## Rollen en permissies

| Rol | Rechten |
|-----|---------|
| **Admin** | Volledige toegang, gebruikersbeheer |
| **Planner** | Evenementen, telcontrole, vulplanning |
| **Teller** | Telronden starten en uitvoeren |
| **Vuller** | Vulrondes claimen en uitvoeren |

---

## CSV-importformaten

### Voorraadnormen

```csv
kiosk_number,product_name,target_quantity,input_step,active
101,Bierbeker 0,5 liter,15,1,true
101,Water blauw,12,0.5,true
```

---

## Offline synchronisatie

De app slaat alle wijzigingen direct op in **IndexedDB** (Dexie).  
Bij herstel van de internetverbinding synchroniseert een outbox-pattern de wijzigingen naar de server.

Bij conflicten (bijv. twee tellers voor dezelfde kiosk) worden beide versies bewaard en kan een planner of admin kiezen welke versie geldig is.
