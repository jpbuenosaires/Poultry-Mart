<?php
/**
 * UserService — user account and address management.
 *
 * Covers every user-facing operation across all four portals:
 *   • Profile get / update / password change
 *   • Address CRUD with default-address management
 *   • Admin-level user CRUD (create / edit / activate / deactivate)
 *   • Geo-data lookup (municipalities + barangays) for address forms
 *
 * All DB calls use BaseService prepared-statement wrappers.
 * Zero raw mysqli_* calls appear anywhere in this class.
 */
class UserService extends BaseService
{
    // ═══════════════════════════════════════════════════════════════
    //  USER CRUD  (admin-facing)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Create or update a user account.
     *
     * When $userId = 0 a new record is inserted.
     * When $userId > 0 the existing record is updated.
     * Password is only changed when a non-empty $password is supplied.
     *
     * @param int    $userId   0 = insert, >0 = update.
     * @param string $firstName
     * @param string $lastName
     * @param string $email    Must be unique across the users table.
     * @param string $phone
     * @param string $roleName Must match a value in the roles.role_name column.
     * @param string $password Plain-text password.  Pass '' on update to leave unchanged.
     * @return int  user_id of the saved record.
     * @throws InvalidArgumentException When email is already taken by another user.
     * @throws RuntimeException         When the given roleName does not exist.
     */
    public function saveUser(
        int    $userId,
        string $firstName,
        string $lastName,
        string $email,
        string $phone,
        string $roleName,
        string $password = '',
        int    $actorId = 0
    ): int {
        // ── Resolve role_id ────────────────────────────────────────
        $role = $this->fetchOne(
            "SELECT role_id FROM roles WHERE role_name = ? LIMIT 1",
            's',
            [$roleName]
        );
        if (!$role) {
            throw new RuntimeException("Role '{$roleName}' does not exist.");
        }
        $roleId = (int) $role['role_id'];

        // ── UPDATE existing user ────────────────────────────────────
        if ($userId > 0) {
            // Check email uniqueness — allow the user to keep their own email
            $conflict = $this->fetchOne(
                "SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1",
                'si',
                [$email, $userId]
            );
            if ($conflict) {
                throw new InvalidArgumentException('That email address is already registered to another account.');
            }

            if ($password !== '') {
                // Update with new password
                $this->execute(
                    "UPDATE users
                     SET first_name = ?, last_name = ?, email = ?, phone = ?,
                         role_id = ?, password_hash = ?
                     WHERE user_id = ?",
                    'ssssssi',
                    [
                        $firstName, $lastName, $email, $phone,
                        $roleId, password_hash($password, PASSWORD_BCRYPT),
                        $userId,
                    ]
                );
            } else {
                // Update without touching password
                $this->execute(
                    "UPDATE users
                     SET first_name = ?, last_name = ?, email = ?, phone = ?, role_id = ?
                     WHERE user_id = ?",
                    'ssssii',
                    [$firstName, $lastName, $email, $phone, $roleId, $userId]
                );
            }

            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'update_user', 'user', ?, ?)",
                'iis',
                [$actorId, $userId, "User #$userId updated: email=$email, role=$roleName"]
            );
            return $userId;
        }

        // ── INSERT new user ─────────────────────────────────────────
        if ($password === '') {
            throw new InvalidArgumentException('Password is required when creating a new user.');
        }

        try {
            $newId = $this->insertGetId(
                "INSERT INTO users (first_name, last_name, email, phone, role_id, password_hash, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'active')",
                'ssssis',
                [
                    $firstName, $lastName, $email, $phone,
                    $roleId, password_hash($password, PASSWORD_BCRYPT),
                ]
            );
            $this->execute(
                "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
                 VALUES (?, 'create_user', 'user', ?, ?)",
                'iis',
                [$actorId, $newId, "User created: email=$email, role=$roleName"]
            );
            return $newId;
        } catch (RuntimeException $e) {
            // Surface duplicate-email constraint as a readable message
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                throw new InvalidArgumentException('That email address is already registered.');
            }
            throw $e;
        }
    }

    /**
     * Return a full user profile including addresses.
     *
     * @param int $uid
     * @return array|null  Null when the user does not exist.
     */
    public function getProfile(int $uid): ?array
    {
        $user = $this->fetchOne(
            "SELECT u.user_id, u.first_name, u.last_name, u.email,
                    u.phone, u.status, u.created_at,
                    r.role_name
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE u.user_id = ?
             LIMIT 1",
            'i',
            [$uid]
        );

        if (!$user) {
            return null;
        }

        $user['addresses'] = $this->fetchAll(
            "SELECT a.address_id, a.label, a.street, a.is_default,
                    a.latitude, a.longitude,
                    b.barangay_id, b.name AS barangay,
                    m.municipality_id, m.name AS municipality,
                    m.name AS city
             FROM addresses a
             LEFT JOIN barangays      b ON b.barangay_id        = a.barangay_id
             LEFT JOIN municipalities m ON m.municipality_id    = a.municipality_id
             WHERE a.user_id = ?
             ORDER BY a.is_default DESC, a.address_id ASC",
            'i',
            [$uid]
        );

        return $user;
    }

    /**
     * Update a user's display name and phone number.
     *
     * @param int    $uid
     * @param string $firstName
     * @param string $lastName
     * @param string $phone
     */
    public function updateProfile(int $uid, string $firstName, string $lastName, string $phone): void
    {
        $this->execute(
            "UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE user_id = ?",
            'sssi',
            [$firstName, $lastName, $phone, $uid]
        );
    }

    /**
     * Change a customer's password after verifying their current password.
     *
     * @param int    $uid
     * @param string $currentPassword  Plain-text current password.
     * @param string $newPassword      Plain-text new password (min 8 chars enforced by caller).
     * @throws RuntimeException         When the current password is wrong.
     * @throws InvalidArgumentException When the new password is too short.
     */
    public function changeCustomerPassword(int $uid, string $currentPassword, string $newPassword): void
    {
        if (strlen($newPassword) < 8) {
            throw new InvalidArgumentException('New password must be at least 8 characters.');
        }

        $row = $this->fetchOne(
            "SELECT password_hash FROM users WHERE user_id = ? LIMIT 1",
            'i',
            [$uid]
        );

        if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
            throw new RuntimeException('Current password is incorrect.');
        }

        $this->execute(
            "UPDATE users SET password_hash = ? WHERE user_id = ?",
            'si',
            [password_hash($newPassword, PASSWORD_BCRYPT), $uid]
        );
    }

    /**
     * Admin password reset — sets a new password without verifying the old one.
     * Only callable from admin_api.php (Super Admin role guard enforced there).
     *
     * @param int    $uid
     * @param string $newPassword  Plain-text new password.
     * @throws InvalidArgumentException When password is too short.
     */
    public function adminResetPassword(int $uid, string $newPassword): void
    {
        if (strlen($newPassword) < 8) {
            throw new InvalidArgumentException('Password must be at least 8 characters.');
        }

        $this->execute(
            "UPDATE users SET password_hash = ? WHERE user_id = ?",
            'si',
            [password_hash($newPassword, PASSWORD_BCRYPT), $uid]
        );
    }

    /**
     * Throw a RuntimeException when the user's account is not active.
     * Used as a mid-session guard before high-value operations (checkout).
     *
     * @param int $uid
     * @throws RuntimeException
     */
    public function checkUserActive(int $uid): void
    {
        $row = $this->fetchOne(
            "SELECT status FROM users WHERE user_id = ? LIMIT 1",
            'i',
            [$uid]
        );

        if (!$row || $row['status'] !== 'active') {
            throw new RuntimeException('Your account is inactive. Please contact support.');
        }
    }

    /**
     * Activate or deactivate a user account.
     *
     * @param int    $uid
     * @param string $status  'active' or 'inactive'
     * @throws InvalidArgumentException On invalid status value.
     */
    public function setUserStatus(int $uid, string $status, int $actorId = 0): void
    {
        if (!in_array($status, ['active', 'inactive'], true)) {
            throw new InvalidArgumentException("Status must be 'active' or 'inactive'.");
        }

        $this->execute(
            "UPDATE users SET status = ? WHERE user_id = ?",
            'si',
            [$status, $uid]
        );
        $this->execute(
            "INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
             VALUES (?, 'set_user_status', 'user', ?, ?)",
            'iis',
            [$actorId, $uid, "User #$uid status set to $status"]
        );
    }

    /**
     * Return all users for admin management, with optional filters.
     *
     * @param string $roleName  Filter by role_name, or '' for all roles.
     * @param string $search    Search against first_name, last_name, email (partial match).
     * @param string $status    Filter by status ('active', 'inactive', or '' for all).
     * @return array
     */
    public function getAllUsers(string $roleName, string $search, string $status): array
    {
        $conditions = ['1=1'];
        $types      = '';
        $params     = [];

        if ($roleName !== '') {
            $conditions[] = 'r.role_name = ?';
            $types .= 's';
            $params[] = $roleName;
        }

        if ($search !== '') {
            $conditions[] = '(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)';
            $like = "%{$search}%";
            $types .= 'sss';
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        if ($status !== '') {
            $conditions[] = 'u.status = ?';
            $types .= 's';
            $params[] = $status;
        }

        $where = implode(' AND ', $conditions);

        return $this->fetchAll(
            "SELECT u.user_id, u.first_name, u.last_name, u.email,
                    u.phone, u.status, u.created_at,
                    r.role_name
             FROM users u
             JOIN roles r ON r.role_id = u.role_id
             WHERE {$where}
             ORDER BY r.role_name ASC, u.last_name ASC, u.first_name ASC",
            $types,
            $params
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  ADDRESS MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    /**
     * Add a new delivery address for a user.
     *
     * If $isDefault is true, all existing addresses for the user are first
     * demoted so only the new one carries the is_default flag.
     *
     * @param int    $uid
     * @param string $label            e.g. 'Home', 'Office', 'Other'
     * @param string $street
     * @param int    $barangayId
     * @param int    $municipalityId
     * @param bool   $isDefault
     */
    public function addAddress(
        int    $uid,
        string $label,
        string $street,
        int    $barangayId,
        int    $municipalityId,
        bool   $isDefault
    ): void {
        if ($isDefault) {
            $this->execute(
                "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
                'i',
                [$uid]
            );
        }

        // If this is the user's very first address, force it to be default
        $existing = $this->fetchOne(
            "SELECT COUNT(*) AS n FROM addresses WHERE user_id = ?",
            'i',
            [$uid]
        );
        if ((int) ($existing['n'] ?? 0) === 0) {
            $isDefault = true;
        }

        $this->execute(
            "INSERT INTO addresses (user_id, label, street, barangay_id, municipality_id, is_default)
             VALUES (?, ?, ?, ?, ?, ?)",
            'issiii',
            [$uid, $label, $street, $barangayId, $municipalityId, (int) $isDefault]
        );
    }

    /**
     * Update an existing delivery address.
     *
     * Verifies that the address belongs to the given user before modifying.
     *
     * @throws RuntimeException When the address does not belong to the user.
     */
    public function updateAddress(
        int    $uid,
        int    $addressId,
        string $label,
        string $street,
        int    $barangayId,
        int    $municipalityId,
        bool   $isDefault
    ): void {
        $addr = $this->fetchOne(
            "SELECT address_id FROM addresses WHERE address_id = ? AND user_id = ? LIMIT 1",
            'ii',
            [$addressId, $uid]
        );

        if (!$addr) {
            throw new RuntimeException('Address not found or does not belong to your account.');
        }

        if ($isDefault) {
            $this->execute(
                "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
                'i',
                [$uid]
            );
        }

        $this->execute(
            "UPDATE addresses
             SET label = ?, street = ?, barangay_id = ?, municipality_id = ?, is_default = ?
             WHERE address_id = ? AND user_id = ?",
            'ssiiiii',
            [$label, $street, $barangayId, $municipalityId, (int) $isDefault, $addressId, $uid]
        );
    }

    /**
     * Delete a delivery address.
     *
     * Verifies ownership before deleting.  If the deleted address was the
     * default and other addresses remain, the oldest remaining address is
     * promoted to default automatically.
     *
     * @throws RuntimeException When the address does not belong to the user.
     */
    public function deleteAddress(int $uid, int $addressId): void
    {
        $addr = $this->fetchOne(
            "SELECT address_id, is_default FROM addresses WHERE address_id = ? AND user_id = ? LIMIT 1",
            'ii',
            [$addressId, $uid]
        );

        if (!$addr) {
            throw new RuntimeException('Address not found or does not belong to your account.');
        }

        $wasDefault = (bool) $addr['is_default'];

        $this->execute(
            "DELETE FROM addresses WHERE address_id = ? AND user_id = ?",
            'ii',
            [$addressId, $uid]
        );

        // Promote the next oldest address if the deleted one was default
        if ($wasDefault) {
            $next = $this->fetchOne(
                "SELECT address_id FROM addresses WHERE user_id = ? ORDER BY address_id ASC LIMIT 1",
                'i',
                [$uid]
            );
            if ($next) {
                $this->execute(
                    "UPDATE addresses SET is_default = 1 WHERE address_id = ?",
                    'i',
                    [(int) $next['address_id']]
                );
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  GEO DATA
    // ═══════════════════════════════════════════════════════════════

    /**
     * Return all municipalities, each with its barangays nested as an array.
     *
     * Used to populate address-form dropdowns on the customer portal
     * and the admin user-management form.
     *
     * @return array  [ { municipality_id, name, barangays: [ { barangay_id, name }, … ] }, … ]
     */
    public function getGeoData(): array
    {
        $municipalities = $this->fetchAll(
            "SELECT municipality_id, name FROM municipalities ORDER BY name ASC"
        );

        $barangays = $this->fetchAll(
            "SELECT barangay_id, municipality_id, name FROM barangays ORDER BY name ASC"
        );

        // Index barangays by municipality_id for O(n) grouping
        $barangayMap = [];
        foreach ($barangays as $b) {
            $barangayMap[(int) $b['municipality_id']][] = [
                'barangay_id' => (int) $b['barangay_id'],
                'name'        => $b['name'],
            ];
        }

        foreach ($municipalities as &$m) {
            $m['barangays'] = $barangayMap[(int) $m['municipality_id']] ?? [];
        }
        unset($m);

        return $municipalities;
    }
}