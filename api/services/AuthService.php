<?php
/**
 * AuthService — portal authentication.
 *
 * Handles credential verification for every PoultryMart portal.
 * Each portal passes its own $allowedRoles whitelist so a single
 * login() method serves all four portals without branching logic
 * scattered across API files.
 *
 * Usage — customer portal (any customer role)
 * ───────────────────────────────────────────
 *   $auth = new AuthService($conn);
 *   $result = $auth->login($email, $password, ['Customer']);
 *   if (!$result['success']) { Response::error($result['message'], 401); }
 *   Response::ok(['user' => $result['user']]);
 *
 * Usage — admin portal (Super Admin only)
 * ───────────────────────────────────────
 *   $result = $auth->login($email, $password, ['Super Admin']);
 *
 * Usage — fulfillment portal (staff + super admin)
 * ─────────────────────────────────────────────────
 *   $result = $auth->login($email, $password, ['Fulfillment Staff', 'Super Admin']);
 *
 * Return shape
 * ────────────
 *   Success: ['success' => true,  'message' => '...', 'user' => [...]]
 *   Failure: ['success' => false, 'message' => '...']
 *
 * The returned user array never contains password_hash.
 */
class AuthService extends BaseService
{
    /**
     * Authenticate a user against a set of allowed roles.
     *
     * All failure paths return the same generic message to prevent
     * user-enumeration attacks — the caller never learns whether the
     * email exists, the password is wrong, the account is inactive,
     * or the role is unauthorised.
     *
     * @param string   $email
     * @param string   $password
     * @param string[] $allowedRoles  Role names permitted to log in via this portal.
     *                                Pass an empty array to allow any active role.
     * @return array   ['success' => bool, 'message' => string, 'user' => array|null]
     */
    public function login(string $email, string $password, array $allowedRoles = []): array
    {
        $genericFailure = ['success' => false, 'message' => 'Invalid email or password.'];

        // ── 1. Basic input guard ───────────────────────────────────
        $email    = trim($email);
        $password = trim($password);

        if ($email === '' || $password === '') {
            return $genericFailure;
        }

        // ── 2. Fetch user row + role name ──────────────────────────
        $user = $this->fetchOne(
            "SELECT u.user_id, u.first_name, u.last_name, u.email,
                    u.phone, u.password_hash, u.status, u.created_at,
                    r.role_id, r.role_name
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE u.email = ?
             LIMIT 1",
            's',
            [$email]
        );

        if (!$user) {
            return $genericFailure;
        }

        // ── 3. Verify password ─────────────────────────────────────
        if (!password_verify($password, $user['password_hash'])) {
            return $genericFailure;
        }

        // ── 4. Check account is active ─────────────────────────────
        if ($user['status'] !== 'active') {
            return [
                'success' => false,
                'message' => 'Your account has been deactivated. Please contact an administrator.',
            ];
        }

        // ── 5. Enforce role whitelist ──────────────────────────────
        if (!empty($allowedRoles) && !in_array($user['role_name'], $allowedRoles, true)) {
            return [
                'success' => false,
                'message' => 'Access denied. You do not have permission to use this portal.',
            ];
        }

        // ── 6. Strip sensitive fields before returning ─────────────
        unset($user['password_hash']);

        return [
            'success' => true,
            'message' => 'Login successful.',
            'user'    => $user,
        ];
    }

    /**
     * Verify that a user_id belongs to an active account with one of the
     * allowed roles.  Used by API auth guards to validate every non-login
     * request without passing credentials again.
     *
     * Returns the user row (without password_hash) or null on failure.
     *
     * @param int      $userId
     * @param string[] $allowedRoles  Empty array = any active role.
     * @return array|null
     */
    public function verifySession(int $userId, array $allowedRoles = []): ?array
    {
        if ($userId <= 0) {
            return null;
        }

        $user = $this->fetchOne(
            "SELECT u.user_id, u.first_name, u.last_name, u.email,
                    u.phone, u.status, u.created_at,
                    r.role_id, r.role_name
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id = ?
             LIMIT 1",
            'i',
            [$userId]
        );

        if (!$user) {
            return null;
        }

        if ($user['status'] !== 'active') {
            return null;
        }

        if (!empty($allowedRoles) && !in_array($user['role_name'], $allowedRoles, true)) {
            return null;
        }

        return $user;
    }
}