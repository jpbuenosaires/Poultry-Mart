<?php
/**
 * Response — static JSON response helper.
 *
 * Used by every portal API endpoint (customer_api.php, admin_api.php, etc.)
 * to guarantee a consistent JSON envelope on every code path.
 *
 * Envelope shape
 * ──────────────
 *   Success:  { "success": true,  ...extra_keys }
 *   Failure:  { "success": false, "message": "..." }
 *
 * Both methods call exit() so the caller never needs to add a return/exit
 * after invoking them.  The return type `never` communicates this in code.
 *
 * Usage
 * ─────
 *   Response::ok(['data' => $rows]);
 *   Response::ok(['message' => 'Saved.', 'data' => $row], 201);
 *   Response::error('Not found.', 404);
 */
class Response
{
    // ── Success ───────────────────────────────────────────────────

    /**
     * Emit a successful JSON response and terminate.
     *
     * @param array $data   Key-value pairs merged into the envelope.
     *                      Common keys: 'message', 'data', 'user', 'total', 'pages'.
     * @param int   $code   HTTP status code (default 200).
     */
    public static function ok(array $data = [], int $code = 200): never
    {
        http_response_code($code);
        echo json_encode(
            array_merge(['success' => true], $data),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        exit;
    }

    // ── Failure ───────────────────────────────────────────────────

    /**
     * Emit an error JSON response and terminate.
     *
     * @param string $message  Human-readable error description sent to the client.
     * @param int    $code     HTTP status code (default 400).
     */
    public static function error(string $message, int $code = 400): never
    {
        http_response_code($code);
        echo json_encode(
            ['success' => false, 'message' => $message],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        exit;
    }
}