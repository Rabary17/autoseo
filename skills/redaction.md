# Skill Rédaction — index des voix par auteur

Chaque auteur a désormais son propre skill de rédaction **complet et autonome** dans [redaction/](redaction/) — toujours charger le fichier dédié à l'auteur assigné (jamais un extrait condensé partagé), aussi bien pour la génération que pour la relecture (voir le pipeline automatisé `scripts/autopublish/`).

| Auteur | Silos couverts | Fichier |
|---|---|---|
| A — Mécanique & technique | Entretien & révision, Pannes & diagnostic, Pièces détachées & accessoires | [redaction/auteur-a.md](redaction/auteur-a.md) |
| B — Marques, essais & sport auto | Marques & modèles, Essais & comparatifs, Sport auto & passion | [redaction/auteur-b.md](redaction/auteur-b.md) |
| C — Achat & mobilité électrique | Achat voiture neuve, Voiture d'occasion, Électrique & hybride | [redaction/auteur-c.md](redaction/auteur-c.md) |
| D — Démarches, assurance & permis | Carte grise & démarches, Assurance auto, Permis & conduite | [redaction/auteur-d.md](redaction/auteur-d.md) |
| E — Deux-roues & nouvelles mobilités | Moto & scooter, Vélo & nouvelles mobilités, Mobilité partagée & transports | [redaction/auteur-e.md](redaction/auteur-e.md) |
| F — Usages spécifiques & voyage | Carburants & consommation, Camping-car & van, Utilitaires & flottes pro, Road trips & voyage auto | [redaction/auteur-f.md](redaction/auteur-f.md) |

Le mapping silo → auteur détaillé (volumes, tons) reste la source de vérité dans [wordpress-publication.md](wordpress-publication.md) section 4 — ne pas le dupliquer ici.

Chaque fichier `redaction/auteur-*.md` contient : la voix propre à l'auteur, la liste de contrôle anti-tics-LLM (identique pour tous, incluse dans chaque fichier pour qu'il reste autonome), les règles invariantes (structure SEO/GEO, maillage, données factuelles, gating), et un emplacement pour une règle rédactionnelle supplémentaire à venir.
