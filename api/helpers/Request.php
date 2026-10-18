<?php
/**
 * Request — shared input parsing for the portal API controllers.
 *
 * action(): the ?action= query value. body(): decoded JSON request body.
 */
class Request
{
    public static function action(): string
    {
        return $_GET['action'] ?? '';
    }

    public static function body(): array
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}
