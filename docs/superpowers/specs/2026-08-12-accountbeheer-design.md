# Accountbeheer in de app

*12 augustus 2026*

## Het probleem

De app kan geen accounts aanmaken. `IAuthRepository` kent alleen inloggen,
uitloggen, de eigen sessie, het eigen profiel en een lijst van profielen; de
RPC-laag stelt alleen `auth.listProfiles` beschikbaar, en `/admin/users` is een
leeslijst zonder knoppen. Accounts ontstonden tot nu toe uitsluitend via
`npm run seed -- --users`, en dat zet de demo-accounts neer.

Sinds die demo-accounts op 12 augustus 2026 zijn verwijderd — hun wachtwoord
stond in een openbare repo — is er nog één account: de beheerder. De tellers en
vullers kunnen niet meer inloggen, en er is een wedstrijd op 16 augustus. Er
moet dus een weg zijn om accounts aan te maken zonder database-toegang.

## Wat het wordt

Beheer → Gebruikers krijgt schrijfacties, alleen voor ADMIN:

- **aanmaken** met naam, e-mailadres, rollen en een wachtwoord
- **bewerken** van naam, e-mailadres en rollen
- **wachtwoord opnieuw instellen**
- **deactiveren en heractiveren**

Verwijderen zit er niet bij, en dat is geen keuze maar een gevolg van het
schema: elf van de veertien verwijzingen naar `profiles` staan op NO ACTION.
Wie ooit geteld heeft, is niet te verwijderen zonder zijn tellingen mee te
nemen. Deactiveren is bovendien wat je in de praktijk wilt — de tellingen van
iemand die weggaat horen te blijven staan.

## Wachtwoorden

Bij aanmaken staat er een gegenereerd wachtwoord klaar: drie groepen van vier
tekens uit een alfabet zonder `l`, `1`, `I`, `0` en `O`, want die worden
verkeerd overgetikt vanaf een briefje. Eronder een veld om zelf iets in te
vullen, voor wanneer het mondeling doorgegeven moet worden.

Na opslaan is het wachtwoord één keer te zien, groot genoeg om over te nemen.
Daarna niet meer op te vragen — alleen opnieuw in te stellen. Hashen met bcrypt
cost 12, zoals `src/server/auth/session.ts` dat overal doet.

**Sessies vervallen bij een wachtwoordwijziging.** Dat gebeurt nu niet vanzelf:
een sessie wordt herkend aan een token in de `sessions`-tabel, en die blijft
geldig als het wachtwoord verandert. Een reset die de oude sessie laat leven is
geen reset. Bij deactiveren gaat het wél vanzelf goed — `is_active` wordt bij
elke sessiecontrole gelezen (`session.ts:116`) — maar de sessierijen worden voor
de netheid alsnog opgeruimd.

## De grendels

Drie regels, en de eerste is er niet voor de vorm: er is op dit moment één
account, dus één verkeerde klik is genoeg om niemand meer binnen te laten.

1. **De laatste actieve ADMIN blijft.** Niet te deactiveren en niet van zijn
   ADMIN-rol te ontdoen. Geteld wordt over actieve profielen met de rol ADMIN;
   is dat er één, dan zijn beide bewerkingen op dat profiel geweigerd.
2. **Jezelf deactiveren kan niet.** Ook niet als er nog een andere beheerder is
   — uitloggen doe je met de uitlogknop, niet door je account te sluiten.
3. **Dubbel e-mailadres wordt geweigerd** met een nette melding in plaats van
   een databasefout over een unieke index.

Deze regels horen op de server, niet in het formulier: de RPC-laag is de plek
waar ze niet te omzeilen zijn.

## Structuur

De `auth`-repository staat nu inline in `src/server/repositories/index.ts` en
groeit met deze wijziging van één methode naar vijf. Die gaat mee naar
`src/server/repositories/auth.ts`, zoals `kiosk`, `product` en de rest dat al
doen. `index.ts` blijft daarmee wat het is: een register.

De grendels komen in `src/domain/users/guards.ts` — pure functies zonder
database, zodat ze zonder opgetuigde omgeving te testen zijn:

```ts
export function assertMayDeactivate(params: {
  target: Profile
  currentUserId: string
  activeAdminCount: number
}): void
```

Verder: methoden op `IAuthRepository` met een implementatie in zowel
`DemoAuthRepository` als `HttpAuthRepository` — demo-modus mag niet stilletjes
achterlopen — plus regels in `methodPermissions` (`MANAGE_MASTER_DATA`,
ADMIN-only) en argumentschema's in `schemas.ts`.

De UI wordt een formulier op `/admin/users`, in de stijl van de bestaande
beheerschermen. De route valt al onder `MANAGE_MASTER_DATA`.

## Testen

De grendels zijn de kern en krijgen unittests:

- laatste actieve ADMIN deactiveren → geweigerd
- laatste actieve ADMIN zijn ADMIN-rol afnemen → geweigerd
- dat mag wél zodra er een tweede actieve ADMIN is
- jezelf deactiveren → geweigerd
- een inactieve tweede ADMIN telt niet mee als vervanger
- bestaand e-mailadres → geweigerd, met een leesbare melding

Plus een test dat een nieuw profiel precies de gevraagde rollen krijgt, en dat
een wachtwoordwijziging de sessies van dat profiel opruimt.

## Wat er niet in zit

**E-mail.** Geen "je account is aangemaakt"-bericht en geen wachtwoordherstel
per mail. Verzenden vanaf de server belandt in de spammap zonder SPF, DKIM en
DMARC; het vraagt om een verzenddienst en DNS-werk. Wachtwoordherstel vraagt
daarbovenop om tokens, een vervaltermijn, een herstelpagina en een limiet op
aanvragen. En het helpt alleen mensen met een adres dat ze lezen — precies niet
de groep die zijn wachtwoord vergeet. De beheerder die het opnieuw instelt is
sneller. Aparte fase, aparte beslissing.

**Verwijderen.** Zie hierboven: het schema staat het niet toe en deactiveren is
wat je wilt.
