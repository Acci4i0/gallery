# photo field — rebuild study di malik.url

Sito personale a forma di campo di foto in 3D: rebuild study dichiarato di malik.url di Malik Kotb. Concept e design originali © Malik Kotb; ricostruito a scopo di studio con foto personali. Vedi [CREDITS.md](./CREDITS.md).

Vanilla HTML/CSS/JS, nessun build step; Three.js e GSAP da CDN; deploy su GitHub Pages.

Come l'originale: le foto galleggiano nello spazio su fondo bianco, la dimensione segue la profondità, il mouse genera parallasse, si trascina per spostarsi nel campo e l'hover le ingrandisce. Le foto lontane rimpiccioliscono e svaniscono nel bianco via fog.

- `index.html`, `style.css` — il sito.
- `js/photo-field.js` — il campo 3D; l'oggetto `FIELD` in cima raccoglie tutti i parametri.
- `js/media.js` — elenco delle foto (una riga per immagine; aggiungerne una = file in `photos/` + una riga qui).
- `photos/` — le immagini (24, attualmente placeholder).
- `galleria.md` — specifica del progetto.
- `CREDITS.md` — crediti e attribuzione.
