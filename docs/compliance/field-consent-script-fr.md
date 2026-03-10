# Script De Consentement Terrain

## Script Court
"Bonjour. Nous collectons des informations sur ce lieu pour un projet de cartographie terrain. Nous pouvons noter des details du site, la position GPS et prendre une photo du point de vente. Les donnees servent a verifier et publier une base de donnees professionnelle. Vous pouvez refuser la photo ou les informations personnelles. Acceptez-vous cette collecte ?"

## Reponses A Enregistrer
- `obtained`: le participant accepte la collecte prevue
- `refused_pii_only`: la collecte continue sans photo ni informations personnelles
- `not_required`: aucun element personnel n'est concerne
- `withdrawn`: le consentement a ete retire apres collecte

## Carte Terrain
- Expliquer l'objectif en moins de 30 secondes
- Indiquer que la photo est optionnelle si une personne ou un identifiant personnel est visible
- Ne jamais insister en cas de refus
- En cas de doute, choisir `refused_pii_only` et ne pas capturer de PII
