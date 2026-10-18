<?php
/**
 * json_bootstrap — guarantees a clean JSON response on every code path.
 *
 * Must be required BEFORE db.php. Hides PHP notices/warnings from the
 * output (they would corrupt the JSON) and turns uncaught exceptions
 * into a JSON 500.
 */
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', '0');          // never mix PHP errors into our JSON
error_reporting(E_ALL);                  // still log them server-side

set_exception_handler(function (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage(),
    ]);
    exit;
});
