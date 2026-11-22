# Pesmarica Slavimo Gospoda

Spletna aplikacija (PWA) za branje in igranje pesmarice *Slavimo Gospoda* na tablici.

- Kazalo 518 pesmi po številki, abecedi in sklopih
- Razpored za mašo
- Zapiski in besedilo na notah, izvoz pesmi v PDF
- Predvajanje not (MusicXML) s tempom, transpozicijo in glasovi S/A/T/B

PDF-ji pesmarice in zapisi not **niso** v tem repozitoriju – vsak jih doda v aplikacijo na svoji napravi.

## Klavir

Zavihek **Klavir** prenese ločene PDF-je in pripravljeno klavirsko predvajanje iz
`piano/scores.json` v istem zasebnem repozitoriju, ki je nastavljen za Zbor.
Zbirka vključuje sedem prepisov uporabnikovih slik z označenimi dopolnitvami.
PDF-ji, MusicXML in dogodki za predvajanje niso del javnega repozitorija.
Po prvem prenosu PDF in predvajanje delujeta brez povezave.

Predvajalnik podpira **Melodija**, **Desna** (spremljava desne roke) in **Leva**;
»Samo melodija« ter »Vse« sta bližnjici za vajo. Nastavitve teh glasov so ločene
od nastavitev S/A/T/B. Tempo, transpozicija, ponavljanje in zapiski uporabljajo
obstoječi predvajalnik oziroma bralnik.

Preverjanje brez dostopa do zasebnih not:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/piano.cjs
```

Test uporablja izmišljene note in prestrežene odzive GitHuba. Preveri prvi prenos,
neveljavno melodijo, ponovni prenos, vseh sedem PDF-jev, ločene glasove, tempo,
transpozicijo, priljubljene, iskanje, telefon in ponovno odpiranje brez interneta.
Za lokalni preizkus prave zbirke nastavi `PIANO_ASSETS` na mapo, ki vsebuje
`piano/scores.json`. Po potrebi nastavi `CHROMIUM_PATH` na nameščeni Chromium.

## Jazz

Zavihek **Jazz** ima 234 lead sheetov iz zbirke *The Public Domain Song Anthology*
(Berger, Israels; Aperio 2020, CC0): https://doi.org/10.32881/book2.
Za razliko od pesmarice in Klavirja so te datoteke **javne** in ležijo v mapi `jazz/`:
v Sloveniji so proste. Avtorji glasbe in besedila so umrli vsaj 70 let pred 2026 ali pa gre za ljudsko pesem.
Izpuščenih je 114 pesmi iz zbirke, ki so pri nas še zaščitene ali imajo negotov status.
Podrobnosti so v `jazz/README.md`.

Pesem se prenese ob prvem odprtju in nato ostane v napravi. Gumb »Shrani vse« shrani vseh 234 pesmi (21 MB) za uporabo brez interneta.
Predvajalnik je isti kot pri Klavirju. Glasovi so **Melodija**, **Akordi** in **Bas**. Akorde in bas sestavi samodejno iz akordnih oznak, zato to ni aranžma.

```sh
node tests/jazz.cjs
```

Test preveri vseh 234 PDF-jev in predvajalnih zapisov. V brskalniku preveri seznam, iskanje,
odpiranje in predvajanje, priljubljene, »Shrani vse«, telefon in ponovni zagon brez interneta.
