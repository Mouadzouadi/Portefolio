<?php
/**
 * Démo « agent vocal » du site : crée un appel web Retell et renvoie son access_token.
 *
 * Hébergé avec le site : il fonctionne sans le PC de développement.
 *   POST { useCase }  ->  200 { access_token, call_id }
 *
 * Le rôle de l'agent vient de use-cases.php (versionné), jamais du navigateur.
 * Garde-fous (le crédit Retell est payant) : cas d'usage connus uniquement, origine
 * du site, plafond d'appels par heure et par adresse IP, et par jour.
 * La clé API est dans config.php (non versionné, protégé par .htaccess).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

function reply(int $code, array $body): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

$cfg = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : null;
if (!is_array($cfg) || empty($cfg['retell_api_key']) || str_starts_with((string) $cfg['retell_api_key'], 'METTRE_')) {
    reply(503, ['error' => 'Démo non configurée']);
}

// Le navigateur envoie l'origine sur un POST : seul le site (ou le poste de dev) peut appeler.
$origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
$allowedOrigins = $cfg['allowed_origins'] ?? [];
if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: Content-Type');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    reply(204, []);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    reply(405, ['error' => 'POST uniquement']);
}
if ($origin === '' || !in_array($origin, $allowedOrigins, true)) {
    reply(403, ['error' => 'Origine non autorisée']);
}

$in = json_decode((string) file_get_contents('php://input'), true);
$useCase = is_array($in) ? (string) ($in['useCase'] ?? $in['use_case'] ?? '') : '';
$useCases = require __DIR__ . '/use-cases.php';
if (!isset($useCases[$useCase])) {
    reply(400, ['error' => 'Cas d\'usage inconnu']);
}
$agentId = (string) $useCases[$useCase]['agent_id'];
$prompt = trim((string) $useCases[$useCase]['prompt']);

// Plafonds : fichier JSON verrouillé dans le dossier temporaire du serveur (IP hachée, jamais stockée en clair).
$now = time();
$ipKey = hash('sha256', ($cfg['salt'] ?? 'zm') . ($_SERVER['REMOTE_ADDR'] ?? ''));
$file = rtrim(sys_get_temp_dir(), '/\\') . '/zm-retell-demo.json';
$fh = fopen($file, 'c+');
if ($fh && flock($fh, LOCK_EX)) {
    $state = json_decode((string) stream_get_contents($fh), true) ?: [];
    $day = array_values(array_filter($state['day'] ?? [], fn($t) => $t > $now - 86400));
    $mine = array_values(array_filter($state['ip'][$ipKey] ?? [], fn($t) => $t > $now - 3600));
    if (count($mine) >= (int) ($cfg['max_calls_per_ip_hour'] ?? 4) || count($day) >= (int) ($cfg['max_calls_per_day'] ?? 40)) {
        flock($fh, LOCK_UN);
        fclose($fh);
        reply(429, ['error' => 'Limite de démonstrations atteinte']);
    }
    $day[] = $now;
    $mine[] = $now;
    $ips = array_filter($state['ip'] ?? [], fn($l) => max($l ?: [0]) > $now - 3600);
    $ips[$ipKey] = $mine;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode(['day' => $day, 'ip' => $ips]));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
}

$body = ['agent_id' => $agentId];
if ($prompt !== '') {
    $body['retell_llm_dynamic_variables'] = ['prompt_dynamique' => $prompt];
}
$ch = curl_init((string) ($cfg['retell_url'] ?? 'https://api.retellai.com/v2/create-web-call'));
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $cfg['retell_api_key'], 'Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
]);
$raw = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);

$data = is_string($raw) ? json_decode($raw, true) : null;
if ($status < 200 || $status >= 300 || empty($data['access_token'])) {
    error_log('[zm-retell-demo] Retell HTTP ' . $status);
    reply(502, ['error' => 'Service vocal indisponible']);
}
reply(200, ['access_token' => $data['access_token'], 'call_id' => $data['call_id'] ?? null]);
