# Assistant IA (tous fournisseurs)

L’assistant est accessible depuis **Tâches (avancée)** et **Journal quotidien**. Il utilise le modèle par défaut configuré dans **Paramètres → Modèles d’IA** : LM Studio, Ollama, OpenAI, Anthropic, Google Gemini, OpenRouter ou tout serveur compatible OpenAI. L’architecture multi-fournisseurs est décrite dans [`REFONTE.md`](REFONTE.md).

## Connexion

1. Dans **Paramètres → Modèles d’IA**, clique sur « Ajouter un modèle » et choisis le fournisseur.
2. Pour un fournisseur cloud, colle la clé API : elle est chiffrée sur le serveur et n’est jamais renvoyée au navigateur.
3. Pour LM Studio ou Ollama, l’adresse par défaut suffit si le modèle tourne sur la même machine que l’API ; sinon ouvre « Adresse personnalisée ».
4. Teste la connexion, choisis le modèle dans la liste puis enregistre. Le premier modèle enregistré devient le modèle par défaut.

Les appels partent de **FastAPI**, pas du navigateur. Si FastAPI tourne sur un VPS, `127.0.0.1` désigne ce VPS : pour joindre LM Studio ou Ollama sur ton PC, utilise une adresse LAN ou Tailscale et active l’écoute réseau du logiciel. `http://` n’est accepté que vers une adresse locale, LAN ou Tailscale ; un service distant doit utiliser `https://`. Le téléphone utilise la même configuration, sans installation supplémentaire.

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
- [API Ollama](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Sorties structurées JSON](https://lmstudio.ai/docs/developer/openai-compat/structured-output)
