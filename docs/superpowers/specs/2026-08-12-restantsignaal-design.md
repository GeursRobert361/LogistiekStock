# Restantsignaal: normen die te laag blijken

*12 augustus 2026*

## Het probleem

Een norm die te hoog staat verraadt zichzelf. Bij de volgende telling staat er
veel, het telscherm zet de norm ernaast, en boven de 120% verschijnt er al een
waarschuwing. Er is niets extra's voor nodig.

Een norm die te laag staat verraadt zichzelf niet. Een kiosk die halverwege de
wedstrijd leegloopt telt op nul, en een kiosk die precies genoeg had telt óók op
nul. Het verschil tussen "krap gered" en "om 20:30 op en verkoop misgelopen"
staat nergens in de gegevens. Uitverkocht raken wordt ook niet als incident
vastgelegd — die categorieën gaan over kapotte tap, koeling en kassa.

Daardoor is de correctie eenzijdig: te ruime normen worden gevonden en
teruggebracht, te krappe normen blijven staan. Dat is precies de verkeerde kant
op voor de producten die hard lopen.

## De regel

> Een norm van **6 verpakkingen of meer** waarbij bij de telling **minder dan 3
> verpakkingen** overstonden, was vermoedelijk te laag.

Twee grenzen, en allebei met een reden.

**Minimaal 3 over.** Wat er na afloop nog staat is de marge die de kiosk had.
Nul betekent dat de vraag op zijn minst tot aan de norm reikte en misschien
verder — hoeveel verder is niet te zien. Eén of twee betekent dat het net
gehaald is. Drie is de ondergrens waaronder het te spannend wordt.

**Alleen vanaf norm 6.** Van de 1656 actieve normen in productie is 87% gelijk
aan 3 of lager:

| Norm | Aantal |
| ---: | -----: |
| 1 | 682 |
| 2 | 496 |
| 3 | 266 |
| 4–5 | 92 |
| 6–10 | 58 |
| 11+ | 62 |

Een product met norm 1 kan er nooit 3 laten staan. Zonder ondergrens zou de
regel koffie, suiker, roerstaafjes, thee en Fanta permanent aanmerken als te
laag — en 87% ruis maakt de andere 13% onvindbaar. Vanaf 6 is een restant van 3
een marge die een kiosk werkelijk kan hebben. Dat zijn 120 normen: de koeling,
en daar zit ook het volume.

Dit is bewust geen percentage. Een vast getal is aan de vloer uit te leggen
zonder rekenwerk, en de producten waar het over gaat zitten dicht bij elkaar in
grootte.

## Wanneer de regel niets zegt

Het gevaar van dit signaal is dat het te vaak afgaat en daarmee zichzelf
onbruikbaar maakt. Vier gevallen leveren een nul op die geen leegloop is, en
geen daarvan mag een signaal geven:

**Niet geteld.** Een ontbrekende regel is geen nul. De rest van de codebase is
hier streng in en dit signaal volgt dat: alleen een telling die er echt is telt
mee.

**Kiosk overgeslagen of dicht.** Een kiosk zonder afgeronde telling in deze
ronde zegt niets over zijn normen.

**Geen vorig evenement.** Het restant is alleen een uitspraak over de vorige
wedstrijd als die er was. Bij de eerste telling van een kiosk — of van het
seizoen — staat er niets omdat er nog nooit iets stond. `findPreviousEventId` in
`consumptionService` beantwoordt dit al.

**Product niet meer in het assortiment.** Een norm die inactief is gezet hoort
er niet meer te staan; nul is dan de bedoeling.

Bij twijfel geeft het signaal niets. Liever een te lage norm gemist dan een lijst
die niemand meer leest.

## Waar je het ziet

Het nakijkscherm van een afgeronde telronde, bij de kiosk waar het speelt.

Dat is het moment waarop de getallen definitief zijn en waarop iemand die over
normen gaat er sowieso naar kijkt. Op dat moment is het antwoord op "is er veel
blijven staan of juist te weinig" ook precies de vraag die voorligt.

Nadrukkelijk *niet* in het telscherm zelf. Twee redenen: de teller kan geen
normen aanpassen, dus voor hem is het ruis. En de waarde wordt tijdens het typen
gelezen — wie 15 intikt gaat langs 1, en dan zou de waarschuwing opflitsen bij
elk product waar niets aan de hand is.

Het signaal is een regel onder de kiosk, in dezelfde stijl als de bestaande
waarschuwing boven de norm:

```
Bacardi Cola — norm 30, nog 1 over
Stelz Icetea — norm 30, nog 0 over
```

Gesorteerd op wat er het krapst bij stond, want nul is erger dan twee.

## Structuur

Eén domeinfunctie plus de plek waar hij getoond wordt. Geen nieuwe tabel: alles
staat er al, dit is een uitspraak over bestaande tellingen en normen.

**`src/domain/analytics/leftover.ts`** — de regel zelf, zonder database en
zonder React:

```ts
export const MIN_LEFTOVER_QUARTERS = 12 // 3 verpakkingen
export const MIN_NORM_QUARTERS = 24 // 6 verpakkingen

export type LeftoverVerdict = 'TOO_LOW' | 'OK' | 'NOT_APPLICABLE'

export interface LeftoverInput {
  targetQuantityQuarters: number
  /** `null` wanneer er niet geteld is — nadrukkelijk niet hetzelfde als 0. */
  countedQuantityQuarters: number | null
  isStandardActive: boolean
  hasPreviousEvent: boolean
}

export function judgeLeftover(input: LeftoverInput): LeftoverVerdict
```

En daarnaast een functie die een telronde omzet in een gesorteerde lijst
signalen, zoals `buildConsumptionRows` dat doet voor verbruik.

**`src/components/counting/`** — de weergave in het nakijkscherm, naast
`KioskReviewDetail`.

De bestaande analytics zijn het model: een pure functie in `domain/`, het
samenstellen in `services/`, en de component leest alleen af.

## Tests

De domeinfunctie is puur, dus daar ligt het zwaartepunt. Testgevallen, geschreven
vóór de implementatie:

- norm 30, restant 0 → `TOO_LOW`
- norm 30, restant 2,75 → `TOO_LOW` (kwarten tellen mee)
- norm 30, restant 3 → `OK` (de grens zelf is nog goed)
- norm 5, restant 0 → `NOT_APPLICABLE` (onder de normgrens)
- norm 6, restant 0 → `TOO_LOW` (de normgrens zelf telt mee)
- restant `null` → `NOT_APPLICABLE`, ongeacht de norm
- inactieve norm → `NOT_APPLICABLE`
- geen vorig evenement → `NOT_APPLICABLE`

Plus een test op de lijstfunctie dat een overgeslagen kiosk niets oplevert, en
dat de volgorde op krapte klopt.

## Wat dit bewust niet doet

**Normen automatisch verhogen.** Het signaal wijst aan, jij beslist. Eén
wedstrijd is een steekproef van één; een uitverkochte kiosk kan ook een
uitzonderlijk drukke avond zijn geweest.

**Kleine producten dekken.** Onder norm 6 blijft opraken onzichtbaar. Voor koffie
en sauzen is dat een bewuste keuze om de lijst leesbaar te houden. Blijkt later
dat daar ook iets misgaat, dan is een tweede regel voor kleine normen een aparte
beslissing.

**Uitverkocht raken vastleggen.** De echte meting zou zijn dat de vloer meldt dat
iets op is. Dat vraagt een incidentcategorie en een knop in de kiosk, en dat is
een groter gesprek dan dit.

**Terugkijken over meerdere wedstrijden.** Dit oordeelt per telronde. Een norm
die drie keer achter elkaar krap staat is een sterker signaal dan één keer, maar
dat vraagt om historie en om een plek om die te tonen.
