# Een telronde weggooien

*12 augustus 2026*

## Het probleem

Een telronde die verkeerd begonnen is, is nu niet weg te krijgen. Er is
`REOPENED` om een goedgekeurde ronde te corrigeren, en `reopenApprovedKiosk`
om één kiosk terug te zetten, maar dat zijn correcties op afgerond werk. Voor
een ronde die nog loopt en die je gewoon niet meer wilt — verkeerde ring,
verkeerde dag, halverwege in de war geraakt — bestaat geen weg terug.

Erger nog: zolang een ronde actief is bezet hij zijn ring. `blocksSessionWrite`
weigert een tweede actieve ronde voor dezelfde ring, en terecht — twee tellers
die los van elkaar dezelfde kiosken aflopen leveren twee waarheden op. Maar dat
betekent ook dat één vastgelopen ronde de ring blokkeert tot iemand in de
database duikt.

## Wat het wordt

Twee acties, allebei voor ADMIN en PLANNER (`REVIEW_COUNTS`):

**Ronde weggooien.** De telronde verdwijnt met alles eraan: kiosktellingen,
telregels, en de bijvulbehoeften die eruit voortkwamen. De ring is daarna vrij
voor een nieuwe ronde.

**Kiosk opnieuw.** Het telwerk van één kiosk binnen een lopende ronde verdwijnt,
zodat die kiosk opnieuw geteld kan worden. De rest van de ronde blijft staan.
Dit is het gewone geval — meestal is er één kiosk verkeerd geteld, en dan wil je
de andere vierentwintig niet overdoen.

Beide alleen op een ronde die nog niet is goedgekeurd. Een goedgekeurde ronde is
klaar; die corrigeer je via `REOPENED`, dat daar al voor bestaat.

## De waarschuwing

Weggooien is niet terug te draaien, dus het scherm moet zeggen wat er precies
verdwijnt — geen "weet je het zeker?" maar een telling:

> **Telronde weggooien?**
> Eerste ring, gestart op 8 augustus door Robert Geurs.
> Hiermee verdwijnen **3 getelde kiosken** en **58 telregels**.
> Dit is niet terug te draaien.

De aantallen komen uit de ronde zelf. Een lege ronde meldt dat er niets in zit;
dan is de waarschuwing ook navenant korter.

## Het probleem dat niemand ziet aankomen

De app telt offline. Een teller schrijft naar IndexedDB, en de outbox stuurt het
later naar de server. Gooi je een ronde weg terwijl er op een telefoon nog
regels in de outbox staan, dan komen die er na de volgende synchronisatie
gewoon weer in — en dan staat er een halve, herrezen ronde die niemand heeft
geteld.

Drie dingen vangen dat af:

1. **Eerst legen, dan tonen.** Het scherm roept `syncService.flush()` aan
   voordat het de aantallen laat zien, zoals het nakijkscherm dat al doet. Wat
   nog onderweg was telt dan mee in de waarschuwing.
2. **De server weigert wat bij een verdwenen ronde hoort.** Een telregel voor
   een `kioskCountId` die niet meer bestaat wordt afgewezen met een 4xx. Dat is
   geen storing maar een bedrijfsregel, en bij een 4xx stopt de outbox met
   opnieuw proberen in plaats van eeuwig door te gaan.
3. **Lokaal opruimen.** Het apparaat dat de ronde weggooit ruimt zijn eigen
   IndexedDB voor die ronde op. Voor andere apparaten doet punt 2 het werk.

Punt 2 is het belangrijkste en meteen het meeste werk: de foutafhandeling van de
outbox moet een geweigerde regel laten vallen zonder de rest van de wachtrij te
blokkeren. Dat gedrag bestaat al voor bedrijfsregelfouten — hier gaat het erom
dat de server het juiste soort fout teruggeeft.

## Structuur

De regels wie-wat-mag zijn puur en gaan naar `src/domain/counting/reset.ts`:

```ts
export function assertMayDiscardSession(session: CountSession): void
export function assertMayResetKiosk(session: CountSession): void
```

Beide weigeren een goedgekeurde ronde. Ze staan los van de database zodat ze te
testen zijn zonder opgetuigde omgeving.

Daarnaast: `count.discardSession` en `count.resetKioskCount` op de repository,
met een implementatie voor productie én demo; regels in `methodPermissions`
(`REVIEW_COUNTS`); argumentschema's; en een `entityGuard` die controleert dat de
ronde niet goedgekeurd is — dezelfde tweede laag die `count.updateSession` al
gebruikt.

Het verwijderen zelf loopt in één transactie. De verwijderregels in het schema
doen het meeste werk, maar `restock_requirements` hangt aan het evenement en
niet aan de telronde; die moeten expliciet mee voor de kiosken in kwestie,
anders blijft er een bijvulbehoefte staan die nergens meer op slaat.

## Testen

- een goedgekeurde ronde weggooien → geweigerd
- een lopende ronde weggooien → toegestaan
- een kiosk resetten in een goedgekeurde ronde → geweigerd
- weggooien verwijdert kiosktellingen, telregels én de bijvulbehoeften
- een kiosk resetten laat de andere kiosken van de ronde ongemoeid
- een telregel voor een verdwenen kiosktelling levert een 4xx op, geen 5xx

Die laatste is de belangrijkste van de zes: hij bewijst dat een herrezen ronde
niet kan ontstaan.

## Wat er niet in zit

**Ongedaan maken.** Weggooien is definitief. Een prullenbak klinkt vriendelijk
maar betekent dat elke lijst voortaan moet weten wat wel en niet weggegooid is,
en dat is een prijs die deze functie niet waard is. De dagelijkse backup is het
vangnet.

**Een goedgekeurde ronde weggooien.** Daar bestaat `REOPENED` voor, en die weg
houdt de geschiedenis heel.
