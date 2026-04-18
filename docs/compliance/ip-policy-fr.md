# Politique de Propriété Intellectuelle

Version 1.0.0 — En vigueur le 2026-04-18

African Data Layer respecte les droits de propriété intellectuelle et attend la même chose de ses utilisateurs. Ce document décrit la procédure de signalement et de traitement des atteintes PI.

## 1. Contact désigné
- Email : legal@africandatalayer.com
- Formulaire : Paramètres → Légal → Signaler une atteinte PI (`/api/privacy?view=ip-report`)
- Postal : African Data Layer, Bonamoussadi, Douala, Cameroun

## 2. Dépôt d'un signalement
Un signalement complet doit comporter :
1. Nom complet et email du déclarant.
2. Type de cible (`submission`, `point` ou `other`) et référence (identifiant de soumission, identifiant de point ou URL) si disponible.
3. Description de l'atteinte (minimum 20 caractères) identifiant l'œuvre protégée et l'usage non autorisé.
4. Déclaration sous serment, sous peine de parjure, que les informations sont exactes et que le déclarant est titulaire des droits ou autorisé à agir.
5. Signature (nom complet tapé).

Un signalement sciemment faux peut engager la responsabilité civile et pénale du déclarant.

## 3. Tri et réponse
- Les signalements sont placés dans l'onglet IP Reports de l'admin.
- Workflow de statut : `open` → `reviewing` → `resolved` ou `rejected`.
- Première réponse : sous 10 jours ouvrés.
- Une atteinte confirmée entraîne le retrait du contenu, la purge des soumissions fautives et une notification écrite à l'utilisateur concerné.

## 4. Contre-notification
Un utilisateur dont le contenu a été retiré peut envoyer une contre-notification à legal@africandatalayer.com, comprenant la référence du signalement initial, une explication du caractère erroné du retrait et une déclaration sous serment. Le contenu est restauré si le déclarant initial n'engage pas d'action sous 14 jours.

## 5. Récidivistes
Les comptes ayant deux atteintes confirmées sur 12 mois sont suspendus. Une troisième atteinte confirmée entraîne la résiliation définitive et la perte des récompenses en attente.

## 6. Journal d'audit
Chaque signalement et action administrative est consigné dans `security_audit_log` (`ip_report_filed`, `ip_report_updated`) et conservé 24 mois.
