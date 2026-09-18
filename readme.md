# Le Millésime — site vitrine

Site one-page statique (HTML / CSS / JS, sans framework ni build tool) pour la cave à vin et bar à vin **Le Millésime**, à Sens.

## Prévisualiser en local

Aucune installation n'est nécessaire. Deux options :

1. **Ouvrir directement le fichier** : double-cliquer sur `index.html` (fonctionne, mais certains navigateurs limitent le chargement de fichiers locaux).
2. **Servir le dossier** (recommandé) : depuis ce dossier, lancer un petit serveur local, par exemple avec Python :
   ```
   python -m http.server 8000
   ```
   puis ouvrir `http://localhost:8000` dans le navigateur.

Le site peut ensuite être déployé tel quel sur Netlify, Vercel, OVH ou tout hébergement statique (glisser-déposer le dossier suffit sur Netlify).

## Structure des fichiers

```
index.html
style.css
script.js
assets/
  logo.svg                       ← logo (placeholder à remplacer par le vrai logo)
  img/
    hero.jpg                      ← photo de fond du haut de page
    histoire.jpg                  ← photo de la section "Histoire"
    evenements.jpg                ← photo de la section "Événements privés"
    gallery-cave.jpg
    gallery-salon.jpg
    gallery-grands-crus.jpg
    gallery-bordeaux.jpg
    gallery-spiritueux.jpg
    gallery-champagne.jpg
    gallery-ambiance.jpg
    gallery-degustation.jpg
```

Les photos de `assets/img/` sont déjà de vraies photos du lieu (fournies par le client). Elles peuvent être remplacées ou complétées à tout moment — voir ci-dessous.

## Ce qu'il reste à remplacer facilement

### 1. Le logo
`assets/logo.svg` est pour l'instant une reconstitution du logo (rectangle marine, "MILLÉSIME" en crème) en attendant le vrai fichier. Remplacer ce fichier par le logo définitif fourni par le client (PNG ou SVG). Si le nouveau fichier est un `.png`, renommer les références dans `index.html` (`assets/logo.svg` → `assets/logo.png`, présent à 3 endroits : header, footer, favicon) — ou plus simple, exporter le logo au format `.svg` sous le même nom pour ne rien changer.

### 2. Les photos
Chaque image de `assets/img/` peut être remplacée par une nouvelle photo **portant le même nom de fichier** (le plus simple), ou alors utiliser un nouveau nom et mettre à jour l'attribut `src` correspondant dans `index.html`.

Pour chaque `<img>`, pensez à :
- mettre à jour les attributs `width` et `height` avec les vraies dimensions (en pixels) de la photo (évite les sauts de mise en page) ;
- écrire un `alt` descriptif du sujet de la photo ;
- garder `loading="lazy"` (déjà en place) pour les images hors écran d'accueil ;
- compresser la photo avant de l'ajouter (viser ~150–300 Ko par image ; un export JPEG qualité ~75–80 ou un format WebP suffit largement).

Pour ajouter une photo supplémentaire à la galerie : dupliquer un bloc `<figure class="galerie__item">...</figure>` dans la section `#galerie` de `index.html`, et ajouter éventuellement la classe `galerie__item--wide` ou `galerie__item--tall` pour varier la taille dans la grille.

### 3. Les avis clients
Dans `index.html`, section `<section id="avis">` : remplacer le texte de chaque `<blockquote class="avis__card">` (citation + auteur) par de vrais avis copiés depuis Google ou Instagram.

### 4. Le téléphone
Dans `index.html`, section `<section id="infos-pratiques">`, chercher le commentaire `<!-- Placeholder éditable : remplacer par le numéro définitif -->` et remplacer le texte "à venir" par le numéro, par exemple :
```html
<dd><a href="tel:+33386000000">03 86 XX XX XX</a></dd>
```

### 5. Les horaires
Les horaires sont à jour (ouvert tous les jours de 10h à 19h, jusqu'à 1h du matin du jeudi au samedi soir). Pour les modifier, éditer la balise `<dd>` sous `<dt>Horaires</dt>` dans `#infos-pratiques`.

## Notes techniques

- Police de titres : **Fraunces** (serif à caractère), police de texte courant : **Work Sans** — chargées via Google Fonts.
- La carte en bas de page est un simple `<iframe>` Google Maps sans clé API (basé sur l'adresse), à conserver tel quel.
- Le menu mobile et l'animation douce au scroll sont gérés par `script.js` (vanilla JS, sans dépendance).
- Le site respecte `prefers-reduced-motion` : les animations sont désactivées si l'utilisateur l'a demandé dans son système.
