# Assistant local avec LM Studio

L’assistant est accessible depuis **Tâches** et **Logs quotidiens**. Configure le provider dans **Paramètres → Assistant local / LM Studio**.

## Connexion

1. Dans LM Studio, charge un modèle de conversation capable de produire du JSON structuré et démarre le serveur local.
2. Renseigne l’adresse du serveur dans les paramètres, par exemple `http://127.0.0.1:1234/v1` lorsque FastAPI et LM Studio tournent sur le même ordinateur.
3. Si LM Studio demande une authentification, renseigne son jeton. L’adresse et le modèle sont mémorisés dans ce navigateur ; le jeton reste en mémoire pendant la session.
4. Teste la connexion, récupère la liste des modèles, sélectionne le modèle à utiliser et enregistre la connexion.

Les appels partent de **FastAPI**, pas du navigateur. Si FastAPI tourne sur un VPS, `127.0.0.1` désigne ce VPS. Pour joindre LM Studio sur ton PC, utilise une adresse IP privée accessible depuis FastAPI (réseau local ou réseau privé comme Tailscale), et active l’écoute réseau dans LM Studio. Les adresses acceptées sont localhost, les IP de loopback, les IP privées LAN, IPv6 ULA et Tailscale ; les noms DNS personnalisés et adresses publiques sont refusés. Le téléphone utilise lui aussi l’API de l’interface : aucune installation de LM Studio sur Android n’est nécessaire.

## Dicter et créer des tâches

Dans le panneau Assistant, écris une consigne ou dicte-la avec Parakeet. Exemple : « Demain à 10 heures, ajoute préparer mon entretien pendant 45 minutes, puis faire les courses sans horaire. » La date de référence affichée sert à interpréter « demain » et les autres dates relatives.

Choisis **Tâches**, puis lance la préparation. Les propositions restent à l’état de brouillon. Corrige leur titre, leur date, leurs horaires ou leur durée, et retire les propositions inutiles. Clique sur le bouton de validation pour les créer dans l’interface. Une tâche sans date va dans les tâches à planifier ; une tâche datée apparaît au jour correspondant. Les filtres actifs peuvent masquer une tâche créée pour une autre date.

La dictée réutilise le service de transcription Parakeet existant. LM Studio reçoit ensuite le texte de la consigne ; les enregistrements audio restent traités par la transcription locale.

## Analyser une journée ou sept jours

Dans le journal, l’interface enregistre la journée avant de demander l’analyse. Tu peux choisir le mode Journée ou Semaine, ou saisir :

- `/analyse` : la journée de référence ;
- `/analyse jour 2026-10-03` : une journée précise ;
- `/analyse semaine 2026-10-03` : les sept jours du 27 septembre au 3 octobre inclus.

L’analyse utilise les journaux et tâches enregistrés du compte connecté. Les jours sans journal sont signalés comme manquants ; le modèle doit distinguer les observations des interprétations. L’analyse est affichée dans le panneau et n’est pas enregistrée comme un nouveau journal. Toute tâche suggérée attend la même validation que les tâches issues d’une consigne.

La génération expire si le modèle ne répond pas dans le délai prévu. Un modèle incapable de respecter le format structuré produit une erreur au lieu d’une proposition exploitable. Une erreur de connexion ou une annulation de la préparation ne crée aucune tâche.

## Références

- [API OpenAI compatible de LM Studio](https://lmstudio.ai/docs/developer/openai-compat)
- [Sorties structurées JSON](https://lmstudio.ai/docs/developer/openai-compat/structured-output)
