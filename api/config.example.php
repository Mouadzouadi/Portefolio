<?php
/**
 * Modèle de configuration de api/retell-web-call.php — SANS secret.
 * Copier en api/config.php (non versionné) sur l'hébergement, puis renseigner la clé.
 */
return [
    // Clé API Retell (tableau de bord Retell > API Keys).
    'retell_api_key' => 'METTRE_LA_CLE_RETELL_ICI',

    // Agents que la démo a le droit d'appeler (mêmes identifiants que scripts/config.js).
    'agent_ids' => ['agent_5897a12ecb5fa9dff93bd899dc'],

    // Pages autorisées à lancer un appel.
    'allowed_origins' => [
        'https://zmsolutions.fr',
        'https://www.zmsolutions.fr',
        'http://localhost:5500',
        'http://127.0.0.1:5500',
    ],

    // Plafonds pour protéger le crédit Retell.
    'max_calls_per_ip_hour' => 4,
    'max_calls_per_day' => 40,
    'max_prompt_chars' => 8000,

    // Sel pour hacher les adresses IP (mettre une chaîne aléatoire).
    'salt' => 'changer-cette-chaine',
];
