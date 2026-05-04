<?php
/**
 * Ghost Admin API proxy for the Replies Helper.
 *
 * Why this exists: Ghost's Admin API is intended for server-side use only.
 * The Admin API key is secret (anyone with it can edit your posts), and Ghost's
 * CORS policy blocks browser-origin requests anyway. So this small server-side
 * shim:
 *   - holds the API key (never exposed to the browser)
 *   - generates a short-lived JWT signed with HS256
 *   - forwards the request to Ghost and returns the response
 *
 * Drop this file on any PHP-capable host (NAS, shared hosting, VPS) alongside
 * the helper HTML page. The helper calls these endpoints:
 *   GET  ghost-replies-proxy.php?action=list_posts
 *   GET  ghost-replies-proxy.php?action=get_post&id=POST_ID
 *   POST ghost-replies-proxy.php?action=update_post&id=POST_ID
 *
 * SETUP:
 *   1. In Ghost admin → Settings → Integrations → Add custom integration.
 *      Name it "Replies Helper", click Add. Copy the Admin API Key (looks like
 *      "ID:SECRET" — a hex ID and a 64-char hex secret separated by a colon)
 *      and note your Admin API URL — for Ghost(Pro) it's the *.ghost.io URL,
 *      NOT your custom domain. For self-hosted Ghost, it's your site URL.
 *   2. Set the two constants below.
 *   3. Restrict access to this file to trusted IPs / your local network.
 *      Anyone able to reach this URL can edit your posts.
 *
 * License: MIT
 */

// ---- CONFIG ---------------------------------------------------------------

const GHOST_ADMIN_URL = 'https://YOUR-SUBDOMAIN.ghost.io';  // e.g. https://yourblog.ghost.io
const GHOST_ADMIN_KEY = 'YOUR_ID:YOUR_SECRET';              // from Integrations page

// ---- HELPERS --------------------------------------------------------------

/**
 * Generate a short-lived JWT signed with the integration's secret.
 * Ghost expects HS256 with a 5-minute expiration and audience "/admin/".
 */
function ghost_jwt(): string {
    [$id, $secret] = explode(':', GHOST_ADMIN_KEY, 2);
    $secretBin = hex2bin($secret);

    $header = ['alg' => 'HS256', 'typ' => 'JWT', 'kid' => $id];
    $now = time();
    $payload = [
        'iat' => $now,
        'exp' => $now + 5 * 60,
        'aud' => '/admin/',
    ];

    $b64 = fn(string $s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    $headerEnc  = $b64(json_encode($header));
    $payloadEnc = $b64(json_encode($payload));
    $sig = hash_hmac('sha256', "$headerEnc.$payloadEnc", $secretBin, true);
    return "$headerEnc.$payloadEnc." . $b64($sig);
}

/**
 * Make an authenticated request to the Ghost Admin API.
 * Returns [http_code, response_body_string].
 */
function ghost_request(string $method, string $path, ?string $body = null): array {
    $url = GHOST_ADMIN_URL . '/ghost/api/admin' . $path;
    $token = ghost_jwt();

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => [
            "Authorization: Ghost $token",
            'Accept-Version: v6.0',
            'Content-Type: application/json',
        ],
        CURLOPT_TIMEOUT => 20,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);

    if ($response === false) {
        return [500, json_encode(['error' => "curl: $err"])];
    }
    return [$httpCode, $response];
}

function send_json($code, $payload): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo is_string($payload) ? $payload : json_encode($payload);
    exit;
}

// ---- ROUTING --------------------------------------------------------------

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'list_posts': {
            $query = $_GET['query'] ?? '';
            $params = [
                'limit' => 100,
                'fields' => 'id,title,slug,published_at,url',
                'order' => 'published_at desc',
                'filter' => 'status:published',
            ];
            if ($query !== '') {
                $safe = str_replace("'", "\\'", $query);
                $params['filter'] .= "+title:~'$safe'";
            }
            $qs = http_build_query($params);
            [$code, $body] = ghost_request('GET', "/posts/?$qs");
            send_json($code, $body);
        }

        case 'get_post': {
            $id = $_GET['id'] ?? '';
            if (!$id) send_json(400, ['error' => 'Missing id']);
            $params = [
                'fields' => 'id,title,slug,url,codeinjection_foot,updated_at',
            ];
            $qs = http_build_query($params);
            [$code, $body] = ghost_request('GET', "/posts/" . urlencode($id) . "/?$qs");
            send_json($code, $body);
        }

        case 'update_post': {
            $id = $_GET['id'] ?? '';
            if (!$id) send_json(400, ['error' => 'Missing id']);
            $raw = file_get_contents('php://input');
            $in = json_decode($raw, true);
            if (!is_array($in) || !isset($in['updated_at'])) {
                send_json(400, ['error' => 'Body must include updated_at + codeinjection_foot']);
            }
            $payload = json_encode([
                'posts' => [[
                    'codeinjection_foot' => $in['codeinjection_foot'] ?? '',
                    'updated_at' => $in['updated_at'],
                ]],
            ]);
            [$code, $body] = ghost_request('PUT', "/posts/" . urlencode($id) . "/", $payload);
            send_json($code, $body);
        }

        default:
            send_json(404, ['error' => "Unknown action: $action"]);
    }
} catch (Throwable $e) {
    send_json(500, ['error' => $e->getMessage()]);
}
