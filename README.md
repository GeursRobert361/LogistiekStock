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
  repositories/     # Data-laag (demo | supabase)
    interfaces/     # Repository-interfaces
    demo/           # In-memory implementatie (geen database nodig)
    supabase/       # Supabase-implementatie (productie)
  lib/
    quarterUnits.ts # Quarter-unit hulpfuncties
    db/offlineDb.ts # IndexedDB via Dexie
    seed/           # Demodata
  types/            # TypeScript-typen en enums
```

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

Open `http://localhost:3000`. De app start automatisch in **demo-modus** (geen Supabase nodig).

---

## Omgevingsvariabelen

| Variabele | Beschrijving | Standaard |
|-----------|-------------|-----------|
| `NEXT_PUBLIC_APP_MODE` | `demo` of `production` | `demo` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side) | — |
| `NEXT_PUBLIC_APP_URL` | Publieke URL van de app | `http://localhost:3000` |

---

## Demo-modus

In demo-modus draait de app volledig lokaal zonder database.  
Alle data zit in geheugen (demo-repositories) en IndexedDB (offline opslag).

**Demo-accounts** (wachtwoord: `demo1234`):

| Account | Rol |
|---------|-----|
| `admin@demo.nl` | Admin |
| `planner@demo.nl` | Planner |
| `teller1@demo.nl` | Teller |
| `vuller1@demo.nl` | Vuller |

---

## Supabase instellen (productie)

1. Maak een Supabase-project aan
2. Voer de migraties uit:
   ```bash
   supabase db push
   # of handmatig:
   psql $DATABASE_URL < supabase/migrations/001_initial_schema.sql
   psql $DATABASE_URL < supabase/migrations/002_rls_policies.sql
   ```
3. Zet `NEXT_PUBLIC_APP_MODE=production` in `.env.local`
4. Vul de Supabase-omgevingsvariabelen in

---

## Tests uitvoeren

```bash
# Unit tests (Vitest)
npm run test:run

# Unit tests met watch
npm run test

# E2E tests (Playwright) — dev server moet draaien
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

### Eerste deployment

```bash
# SSH naar server
ssh root@5.181.134.106

# Repository klonen
cd /var/www
git clone <repo> LogistiekStock
cd LogistiekStock

# Environment instellen
cp .env.example .env
nano .env  # vul waarden in

# Nginx config plaatsen
cp nginx/stock.niettegeloven.com.conf /etc/nginx/sites-available/stock.niettegeloven.com
ln -s /etc/nginx/sites-available/stock.niettegeloven.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL certificaat
certbot --nginx -d stock.niettegeloven.com

# Docker starten
docker compose up -d --build
```

### Updates deployen

```bash
git push origin main
ssh root@5.181.134.106 "cd /var/www/LogistiekStock && git pull && docker compose up -d --build"
```

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
