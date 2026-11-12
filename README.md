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
