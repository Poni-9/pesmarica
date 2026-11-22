# Jazz – note in melodije za klavir

234 lead sheetov iz zbirke **The Public Domain Song Anthology** (David Berger, Chuck Israels; Aperio Press, 2020), z modernimi (jazz) in tradicionalnimi akordi.

- Knjiga: https://doi.org/10.32881/book2
- Datoteke: https://doi.org/10.18130/V3/C4RD06
- Licenca izdaje: CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/). Velja za harmonizacije, stavek in izbor.

CC0 ne pokriva izvirnih skladb in besedil. Zato je tu le 234 od 348 pesmi iz zbirke. Pri teh so vsi znani avtorji glasbe in besedila umrli vsaj 70 let pred 1. 1. 2026 (pravilo EU/SI, Direktiva 2006/116/ES). Leto, od katerega je pesem prosta, je v `index.json` (`freeSince`). 60 pesmi je tradicionalnih (neznan avtor). Izpuščenih je 94 pesmi, ki so v Sloveniji še zaščitene, in 20 z negotovim statusom. Pravilo krajšega roka (čl. 7(1) direktive) namenoma ni uporabljeno.

## Datoteke

- `pdf/<id>.pdf` – izvirni PDF iz Dataverse, nespremenjen (izvirno ime: `sourceFile` v `index.json`).
- `play/<id>.json` – predvajalni zapis za pesmarico (`v:1, inst:'piano'`). Ustvarjen je iz izvirnega MusicXML:
  - glas 0 je melodija;
  - glas 1 so akordi v desni roki (iz modernih oznak, sicer iz tradicionalnih);
  - glas 2 je bas v levi roki.
  
  Čas je v četrtinkah. Ponavljanja, volte in D.C./D.S. so razviti. Okraski se ne predvajajo. Spremljava je preprost samodejni stavek (akord ob nastopu in na začetku vsakega takta), ne aranžma.
- `index.json` – seznam z naslovi, avtorji, številom strani in velikostjo.

Preverjanje: časovnica melodije se pri 224 od 234 pesmi natančno ujema z Verovio 6.4.1. Pri ostalih 10 je razlika pojasnjena (okraski, takti s celinsko pavzo v 3/4, druga volta pri A-Tisket).
