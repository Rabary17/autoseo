# Commandes du projet autoseo

Commandes slash disponibles dans `.claude/commands/`, une par étape du pipeline de production (voir [plan-auto-mobilite-10000.html](../plan-auto-mobilite-10000.html) section 5 et [plan-auto-mobilite-10000-actions.html](../plan-auto-mobilite-10000-actions.html) pour le détail des sessions).

Chaque commande respecte la règle de [skills/gestion-de-projet.md](../skills/gestion-de-projet.md) : jamais de run massif sans confirmation, mise à jour systématique de [STATE.md](../STATE.md) en fin d'exécution.

## Vue d'ensemble

| Commande | Rôle | Prérequis | Écrit dans |
|---|---|---|---|
| `/resume` | Reprendre le projet où il en est resté | aucun | — (lecture seule) |
| `/credit-check` | Vérifier le solde de crédits Haloscan | clé API dans `.env` | — (lecture seule) |
| `/p1-keywords <silo>` | Collecter les mots-clés d'un silo (Haloscan) | seeds du silo dans `seeds.json` | `data/keywords/<slug>.json` |
| `/p1-status` | Voir l'avancement de la collecte P1 | — | — (lecture seule) |
| `/p2-database <dataset>` | Compiler un lot de données factuelles | — | `data/factuel/<slug>.json` |
| `/p3-mapping [silo]` | Générer le maillage interne | P1 + P2 du silo terminés | `data/maillage/maillage.json` |
| `/p4-hubs <silo>` | Rédiger hub + sous-hubs d'un silo | P3 du silo terminé | pages hub/sous-hub (WordPress) |
| `/p5-articles <silo> <n>` | Produire un batch d'articles (insérés en `draft`) | P4 du silo terminé | pages article WordPress (draft) + `tracking-mots-cles.xlsx` |
| `/p5-schedule [silo]` | Vérifier le gating SEO et programmer les dates de publication (5/jour max, auteurs assignés) | articles en `draft`/`en rédaction` | `post_status=future` + `post_date` WordPress, `tracking-mots-cles.xlsx` |
| `/p6-indexation` | Rituel hebdo indexation/QA | au moins un silo publié | sitemaps, liste de réécriture |

## Détail par commande

### `/resume`
À lancer en tout premier sur une nouvelle session ou avec un nouvel agent. Lit `STATE.md` et les skills pertinents, résume la situation et propose (sans l'exécuter) la prochaine action.

### `/credit-check`
Interroge l'API Haloscan (`user/credit`) et affiche les soldes `creditKeyword`, `creditBulkKeyword`, `creditSite`. À lancer avant tout `/p1-keywords` si le solde n'a pas été vérifié récemment.

### `/p1-keywords <silo>`
Exemple : `/p1-keywords Entretien & révision`
Lance d'abord une simulation (`--dry-run`, 0 crédit consommé), affiche le volume prévu, **attend confirmation**, puis appelle réellement l'API et sauvegarde les résultats dans `data/keywords/<slug-silo>.json` (reprise automatique si déjà partiellement traité).

### `/p1-status`
Aucun argument. Fait le point silo par silo : combien de seeds traités vs attendus, et signale les écarts avec la page d'actions.

### `/p2-database <dataset>`
Exemple : `/p2-database codes OBD lot 1/4`
Compile un des 22 lots de données factuelles (voir table P2 de la page d'actions). Cite toujours la source, ne devine jamais un chiffre.

### `/p3-mapping [silo]`
Sans argument : traite tous les silos dont le P1+P2 sont terminés. Génère les entrées de `maillage.json` (hub, sous-hub, liens latéraux/transversaux, ancres) à partir de `tracking-mots-cles.xlsx`.

### `/p4-hubs <silo>`
Exemple : `/p4-hubs Pannes & diagnostic`
Rédige la page hub et toutes les pages sous-hub du silo, avec le schema.org et le maillage descendant déjà résolus en P3.

### `/p5-articles <silo> <n>`
Exemple : `/p5-articles Entretien & révision 25`
Produit un batch d'articles (25 par défaut = 1 session ≤ 1h) à partir des clusters `à faire` de `tracking-mots-cles.xlsx`, en blocs Gutenberg, avec catégorie/tags/image à la une et auteur assignés. Insère en `draft` — ne programme jamais de date ici (voir `/p5-schedule`).

### `/p5-schedule [silo]`
Sans argument : traite tous les articles en attente. Applique la checklist de gating SEO (anti-cannibalisation, unicité, schema, sources YMYL...), bloque en `draft` ceux qui échouent, puis programme les autres à raison de 5 publications/jour maximum, hubs et sous-hubs toujours en priorité — voir [skills/wordpress-publication.md](../skills/wordpress-publication.md).

### `/p6-indexation`
Checklist hebdomadaire : sitemap du dernier silo publié, rappel de soumission GSC, QA aléatoire sur 5 articles, détection des pages à réécrire après 90 jours.

## Ordre d'exécution type pour un nouveau silo

```
/credit-check
/p1-keywords "<silo>"
/p2-database "<dataset du silo>"      (répéter pour chaque dataset concerné)
/p3-mapping "<silo>"
/p4-hubs "<silo>"
/p5-articles "<silo>" 25              (répéter jusqu'à épuisement du silo)
/p5-schedule "<silo>"                 (gating + programmation des dates, 5/jour max)
/p6-indexation                        (en continu, une fois par semaine)
```
