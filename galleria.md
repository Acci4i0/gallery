## CONTESTO

Stai costruendo un progetto standalone (vanilla HTML/CSS/JS + Three.js e GSAP via CDN, deploy su GitHub Pages). È un rebuild study dichiarato del portfolio di Malik Kotb (`malik.url`): replica 1:1 di estetica, layout, animazioni e interazioni — una distesa di immagini che fluttuano in uno spazio 3D su sfondo bianco — ma con le mie foto. Crea il progetto in una nuova directory dedicata con il suo repository. Inserisci nell'HTML un commento di attribuzione: `<!-- Rebuild study of malik.url by Malik Kotb. Original concept and design © Malik Kotb. Rebuilt for study purposes. -->`

A differenza di altri rebuild, qui sono ammesse **due sole librerie**, entrambe via CDN, niente altro: Three.js r128 e GSAP 3.12.5.

## STEP 0 — ANALISI DELL'ORIGINALE (obbligatorio, prima di scrivere codice)

Fai fetch della live `https://malik.url` e ispeziona la pagina. La fonte primaria del *metodo* è il reel tutorial di Malik (vedi sezione METODO), ma da DevTools estrai e documenta i valori esatti del guscio (chrome) e i colori prima di iniziare:

* font-family, font-size, font-weight, letter-spacing e text-transform di: nome in alto a sinistra, voci di nav (Info / Work / Lab / Contact)
* colore di sfondo (bianco) e colore del testo del chrome; eventuale `mix-blend-mode`
* dimensione tipica delle thumbnail a schermo e densità del campo (quante visibili a colpo d'occhio)
* comportamento al movimento del mouse (entità della parallasse), allo hover (la thumbnail si ingrandisce? mostra una caption?), al drag (si può spostarsi nel campo?)
* eventuale fade delle thumbnail lontane verso il bianco (fog)

Il rendering del campo è un canvas WebGL: i suoi interni non sono leggibili dal sorgente minificato. Per quelli usa il METODO qui sotto. Se il fetch della live fallisce, usa i fallback: sfondo `#ffffff`, chrome in monospace di sistema uppercase ~12px con `mix-blend-mode: difference`, parallasse morbida, hover scale ~1.5×, fog bianco sulle lontane.

## METODO (dal reel di Malik — il *cosa*, non il codice esatto)

Il reel narra la ricetta: **Three.js + GSAP**; un array `media`; ogni elemento è una particella con **posizione random in 3D**; a ciascuna viene assegnata una **texture random** dall'array; gli **shader** disegnano ogni particella (`gl_PointSize = size * (300.0 / -mvPosition.z)` nel vertex; `sampler2D textures[N]` nel fragment); il **mouse** fa rispondere la scena.

Decisione di rendering, vincolante:

* **Default — piani texturizzati (fedele al risultato).** Un `PlaneGeometry` per elemento, scalato sull'aspect ratio della texture, `MeshBasicMaterial` con `map` e `transparent:true`. `THREE.Points` disegna sprite **quadrati** e distorcerebbe foto rettangolari; nel sito reale si vedono card rettangolari, quindi usa i piani. Per 24–40 elementi le performance sono ottime senza shader custom: profondità data dalla prospettiva + fog.
* **Alternativa — Points + ShaderMaterial (fedele alla lettera), solo se richiesto esplicitamente.** In tal caso gestisci il tranello GLSL: in WebGL1 (GLSL ES 1.00) `texture2D(textures[index], ...)` con `index` da una `varying` **non compila** (indicizzazione dinamica di sampler array vietata). Soluzioni corrette: (1) **texture atlas** con `aUvOffset`/`aUvScale` per-punto campionati via `gl_PointCoord`; (2) **loop srotolato** su `N` costante con confronto a indice costante. Non copiare lo snippet del reel così com'è: è didattico, non compila.

## COMPORTAMENTO DEL SITO (osservato dall'originale — replicare tutto)

1. **Sfondo bianco pieno**, canvas a tutto schermo, nessuno scroll. Il chrome (header) sta sempre sopra il canvas.
2. **Campo di foto**: 24–40 istanze sparse con posizione random in 3D (x larga, y media, z in profondità). Più istanze che foto: la stessa foto può comparire più volte in posizioni diverse. Posizioni random a runtime con **seed opzionale** per riproducibilità; non serve hardcodarle.
3. **Profondità → dimensione**: la prospettiva rende le foto lontane piccole, le vicine grandi e nitide. `THREE.Fog` bianco fa **dissolvere nel bianco** le più lontane (campo infinito).
4. **Drift a riposo**: movimento lento e continuo (sin/cos per-elemento con fase random, ampiezza piccola). Mai statico, mai nauseante.
5. **Parallasse col mouse**: la camera scivola in lerp seguendo il cursore e fa `lookAt` verso il centro → il campo drifta in profondità. Niente scatti.
6. **Drag per spostarsi**: premi e trascini → ti muovi nel campo (pan di camera/gruppo). Al rilascio, **inerzia che si smorza**.
7. **Hover**: passando su una foto (raycaster) si ingrandisce in modo fluido (GSAP, ~1.4–1.6×), cursore `pointer`. Una sola foto in hover alla volta; uscendo torna alla scala base.
8. **Entrata**: al load le foto compaiono con fade + scale-in **sfalsato** (stagger GSAP). Niente pop secco.
9. **Spinner** breve al load finché le prime texture non sono pronte. Niente altro nella pagina: nessun menu oltre al chrome, nessun footer.

## CONTENUTI PERSONALIZZATI

**Le mie foto** stanno in `photos/`. Vanilla JS non lista le cartelle, quindi i media vivono in un array esplicito in `js/media.js`:

```js
export const MEDIA = [
  './photos/01.jpg',
  './photos/02.jpg',
  // ... TODO: sostituisci con le mie foto
];
```

Per partire subito, popola `photos/` con 8–12 placeholder locali (anche tinte piatte) e lascia il TODO. Le foto possono avere qualsiasi formato: devono restare al loro aspect ratio reale, niente crop quadrato.

**Chrome (header)** — overlay HTML sopra il canvas, monospace di sistema, uppercase, `mix-blend-mode: difference` per restare leggibile su bianco e sopra le foto:

| Posizione | Contenuto |
|-|-|
| Alto sinistra | ANDREA LANDO |
| Alto destra (nav) | Info · Work · Lab · Contact (link placeholder `#`) |
| Basso sinistra (hint, grigio piccolo) | muovi il mouse · trascina · hover |

Su mobile (`max-width: 600px`) nascondi la nav, tieni il nome. I link `pointer-events: auto`, il resto dell'overlay `pointer-events: none` per non rubare il mouse al canvas.

Blocco **Contact** (se apri un overlay dalla voce Contact — stesso formato prefisso/punto/link):

```
m.  lando.andrea04@gmail.com   → mailto:lando.andrea04@gmail.com
i.  @andrelndo                 → https://instagram.com/andrelndo
©   2026                       → link alla repo del progetto
```

## CAMPO — PARAMETRI (esposti in cima a `photo-field.js`)

Un singolo oggetto `FIELD`, così ritocco tutto senza toccare la logica:

| Parametro | Significato | Default indicativo |
|-|-|-|
| `count` | numero di istanze nel campo | 30 |
| `spreadX` / `spreadY` | ampiezza del campo (unità mondo) | 95 / 58 |
| `depthNear` / `depthFar` | profondità min/max (z) | 10 / −170 |
| `photoHeight` | altezza base di una foto | 15 |
| `parallax` | quanto la camera segue il mouse | 18 |
| `floatAmp` | ampiezza del drift a riposo | 1.6 |
| `seed` | seed RNG (riproducibilità) | opzionale |

Camera `PerspectiveCamera(50, aspect, 0.1, 2000)` su `+z`; `scene.fog = Fog(white, near, far)` tarata sulla profondità; `renderer.outputEncoding = sRGBEncoding`, sulle texture `encoding = sRGBEncoding` e `minFilter = LinearFilter`; `setPixelRatio(min(devicePixelRatio, 2))`.

## VINCOLI TECNICI

* Vanilla HTML/CSS/JS + **solo** Three.js r128 e GSAP 3.12.5 da CDN. Niente altro framework, niente bundler, niente npm, niente build step. File: `index.html`, `style.css`, `js/photo-field.js`, `js/media.js`.
* Deve funzionare su GitHub Pages (solo file statici, percorsi relativi `./...`).
* Responsive desktop e mobile; il campo si adatta all'aspect ratio della finestra; `resize` aggiorna camera e renderer.
* Rispetta `prefers-reduced-motion: reduce`: niente drift né parallasse (scena ferma), hover ok.
* Texture caricate in modo asincrono; ogni foto compare quando è pronta. Nessun `localStorage`/`sessionStorage`, nessun tracker.

## REGOLE DI CODICE (s4.codes — vincolanti)

Nomi intention-revealing e onesti; se devi leggere l'implementazione per capire il nome, il nome è sbagliato. Funzioni piccole, una funzione = una cosa, niente mix di livelli di astrazione, pochi argomenti, Do XOR Answer. Niente side effect nascosti. try/catch invece di codici d'errore. DRY. Funzioni top-level in alto, definizioni sotto i chiamanti. Variabili vicine all'uso.

Struttura suggerita per `photo-field.js`: `FIELD` (parametri), `buildScene()`, `buildPhotoField(media)`, `addPhoto(texture, index)`, `randomPosition()`, `revealPhoto(photo, index)`, `bindEvents()`, `onPointerMove(event)`, `updateHover()`, `driftCamera()`, `floatPhotos(time)`, `onResize()`. Helper in fondo: `aspect()`, `randomBetween(min, max)`.

## CRITERI DI ACCETTAZIONE

1. Apro `index.html` in locale → campo di foto visibile e in movimento, nessun errore in console.
2. Le foto rispettano il loro aspect ratio: niente crop né distorsione.
3. Mouse fermo: drift lento. Mouse in movimento: parallasse fluida. Drag: pan con inerzia che si smorza.
4. Hover: la foto puntata si ingrandisce e il cursore diventa pointer; una alla volta.
5. Foto lontane più piccole e sfumate nel bianco; vicine più grandi e nitide.
6. Header sempre leggibile sopra il canvas, anche sopra le foto; su mobile la nav sparisce.
7. Stesso comportamento su GitHub Pages (percorsi relativi).
8. `prefers-reduced-motion` rispettato.
9. Aggiungere una foto = file in `photos/` + una riga in `js/media.js`. Nient'altro.
10. Affiancato a malik.url, un osservatore non distingue stile, densità del campo, parallasse e hover (a parte i contenuti).