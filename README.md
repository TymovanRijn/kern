# Kern

Eén persoonlijke web-app (PWA) met meerdere onderdelen die samenwerken. Alles draait in de browser en alle gegevens blijven op het eigen toestel: geen account, geen server, geen build-stap.

## Onderdelen

| Onderdeel | Map | Wat het doet |
|---|---|---|
| Vandaag | `/` | Ochtendcheck (HRV, rusthartslag, slaap), herstelanalyse en één dagadvies. Met een Polar H10 en een browser met Web Bluetooth (zoals Bluefy) meet de app zelf je rMSSD en rusthartslag |
| Tempo | `tempo/` | Duurtraining: vorm, schema, prognose, optionele Strava-koppeling |
| Kracht | `kracht/` | Krachtlog met routines, rusttimer en voortgang per oefening |
| Eten | `eten/` | Plantaardig weekmenu (55 recepten met bereiding, alleen gasfornuis en airfryer) afgestemd op de training; kiest de goedkoopste week en rekent de boodschappen uit per verpakking |
| Geld | `geld/` | Uitgaven uit een bank-CSV, categorieën en vaste lasten |
| Hart | `hart/` | Live ECG, hartslag, HRV, DFA α1, Poincaré en spectrum met een Polar H10; opnames met ruw ECG (IndexedDB), CSV-export, ochtendmeting naar Vandaag |
| Amifo | `amifo/` | Vriendenboek |

## Architectuur

- **Eén app, meerdere pagina's.** Eén `manifest.json` en één service worker (`sw.js`) met de hele map als bereik. Elk onderdeel is een eigen pagina; daardoor delen ze dezelfde lokale opslag.
- **Gedeelde laag** in `core/`: `core.css` (ontwerp-tokens en componenten) en `core.js` (opslag, sheet, toast, tabbar, back-up).
- **Opslag per onderdeel** onder `kern.<naam>.v1` in `localStorage` (Amifo gebruikt IndexedDB).
- **Feeds.** Elk onderdeel publiceert een korte samenvatting onder `kern.feed.<naam>`. Andere onderdelen lezen alleen die samenvatting, nooit elkaars ruwe gegevens:
  - Tempo → Eten: soort training per dag bepaalt koolhydraatdoel en porties
  - Tempo → Kracht: waarschuwing bij zware benen vlak voor een sleuteltraining
  - Kracht → Tempo: krachtsessies tellen mee als geschatte belasting
  - Eten → Geld: geschatte prijs van het weekmenu naast de werkelijke uitgaven
  - Kracht → Geld: sportkosten per krachtsessie
  - Alles → Vandaag: check, vorm en schema worden één advies
- **Back-up.** Eén JSON-bestand met alle onderdelen, te maken en terug te zetten bij Instellingen. Inloggegevens van koppelingen gaan niet mee.

## Bluetooth

Web Bluetooth werkt in Chrome en Edge (macOS, Windows, Android) en in Bluefy (iOS); niet in Safari of Firefox. Hart gebruikt naast de standaard Heart Rate Service ook de Polar Measurement Data-service (`fb005c80-…`) voor ruw ECG op 130 Hz.


Safari en een PWA op het beginscherm van iOS ondersteunen geen Web Bluetooth. In Bluefy kan de ochtendcheck de Heart Rate Service van een borstband lezen (RR-intervallen) en daar rMSSD en rusthartslag uit berekenen. Bluefy bewaart gegevens apart van Safari; een gemeten waarde kan als korte code (`KERN-HRV;datum;hrv;rusthartslag`) worden overgezet.

## Schermen

Alle onderdelen delen dezelfde onderschermen (`K.openSheet`). Een open scherm beweegt mee met je vinger en sluit als je naar beneden veegt; de pagina erachter scrolt niet mee. Amifo heeft een eigen versie met hetzelfde gedrag.

## Een onderdeel toevoegen

1. Maak een map met een `index.html` die `../core/core.css` en `../core/core.js` laadt en `K.chrome('<naam>')` aanroept.
2. Bewaar de staat met `K.load('kern.<naam>.v1', standaard)` en `K.save(...)`.
3. Publiceer wat anderen mogen weten met `K.feed.set('<naam>', {...})`.
4. Voeg de map toe aan `SHELL` in `sw.js` en aan `APPS` in `index.html`.

## Lokaal draaien

```sh
python3 -m http.server 8000
```

## Installeren op een iPhone

Open de GitHub Pages-URL in Safari, tik op Deel en kies "Zet op beginscherm".

## Privacy

De code in deze repository bevat geen persoonlijke gegevens. Wat je in de app invult staat alleen in de opslag van je eigen browser. Bij de eerste start toont elk onderdeel verzonnen demodata, te wissen bij Instellingen. Voedingswaarden, prijzen en trainingsbelasting zijn schattingen; de app geeft geen medisch advies.
