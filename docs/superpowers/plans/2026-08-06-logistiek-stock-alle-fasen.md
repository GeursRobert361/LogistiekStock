# LogistiekStock — Implementatieplan (alle fasen)

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Volledige mobiele PWA voor het tellen en bijvullen van voorraden in kiosken van de Johan Cruijff ArenA.

**Architecture:** Next.js 15 App Router met strikte domeinscheiding (domain / repositories / services / features). Demo-modus via in-memory repositories zodat de app draait zonder Supabase. Offline-first via IndexedDB (Dexie) met outbox-sync.

**Tech Stack:** Next.js 15, TypeScript 5 strict, Tailwind CSS, shadcn/ui, Supabase, React Hook Form, Zod, TanStack Query, Dexie, Vitest, Playwright, Docker

## Global Constraints
- TypeScript strict mode — nooit `any` zonder comment
- Nederlandstalige UI
- Quarter units intern voor alle hoeveelheden (1 pak = 4 QU)
- Port 3003 op server (root@5.181.134.106)
- Domain: stock.niettegeloven.com (aanpasbaar via .env)
- Docker + Nginx + SSL (Certbot)
- Geen secrets in de repository

---

## FASE 1: Project + Domeinlogica + Tests

### Task 1.1: Next.js project setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.env.example`
- Create: `prettier.config.js`
- Create: `.eslintrc.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

### Task 1.2: Domain types

**Files:**
- Create: `src/types/index.ts`
- Create: `src/types/domain.ts`
- Create: `src/types/enums.ts`

### Task 1.3: Quarter units library + tests

**Files:**
- Create: `src/lib/quarterUnits.ts`
- Create: `src/lib/__tests__/quarterUnits.test.ts`

### Task 1.4: Restock calculation + tests

**Files:**
- Create: `src/domain/counting/calculateRestock.ts`
- Create: `src/domain/counting/__tests__/calculateRestock.test.ts`

### Task 1.5: Circular kiosk route + tests

**Files:**
- Create: `src/domain/routing/kioskRoute.ts`
- Create: `src/domain/routing/__tests__/kioskRoute.test.ts`

---

## FASE 2: Database + Auth + Rollen

### Task 2.1: Supabase migrations
- Create: `supabase/migrations/*.sql`

### Task 2.2: Repository interfaces + demo implementatie
- Create: `src/repositories/interfaces/*.ts`
- Create: `src/repositories/demo/*.ts`
- Create: `src/repositories/supabase/*.ts`

### Task 2.3: Seeddata
- Create: `src/lib/seed/demoData.ts`
- Create: `scripts/seed.ts`

### Task 2.4: Auth
- Create: `src/features/auth/**`
- Create: `src/app/(auth)/login/page.tsx`

---

## FASE 3: Beheer (events, kiosken, producten, normen)

- Events CRUD
- Kiosk beheer
- Product beheer
- Voorraadnorm beheer + matrixweergave
- Admin pagina's

---

## FASE 4: Mobiele telworkflow + offline

- Telronde starten
- Kiosk tellen (QuarterQuantityInput etc.)
- IndexedDB autosave
- Outbox sync
- Offline indicator

---

## FASE 5: Controle + restockvereisten

- Controlescherm
- Goedkeuring telling
- Genereren restock requirements

---

## FASE 6: Vulrondes + pallets + aflevering

- Productrondes
- Gemengde pallets
- Afleverworkflow per kiosk

---

## FASE 7: Storingen + dashboard + import/export

- Storingen beheer
- Dashboard (realtime)
- CSV import/export

---

## FASE 8: PWA + E2E tests + Docker + deployment

- PWA manifest + service worker
- Playwright E2E tests
- Dockerfile + docker-compose.yml
- Nginx config
- README
