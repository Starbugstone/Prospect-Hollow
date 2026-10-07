<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\Connection;

/**
 * Values admins change in the panel, kept in admin_settings so they need no server
 * configuration or release: the activity log retention and the privacy contact.
 */
final class SiteSettings
{
    public const PRIVACY_CONTACT = 'privacy_contact';

    public static function get(Connection $db, string $name): ?string
    {
        $value = $db->fetchOne('SELECT value FROM admin_settings WHERE name=?', [$name]);
        return is_string($value) ? $value : null;
    }

    /** Stores a value, or removes the setting when it is null. */
    public static function set(Connection $db, string $name, ?string $value): void
    {
        if ($value === null) {
            $db->delete('admin_settings', ['name' => $name]);
        } elseif (!$db->update('admin_settings', ['value' => $value], ['name' => $name])) {
            $db->insert('admin_settings', ['name' => $name, 'value' => $value]);
        }
    }

    /** The address players write to about their data, shown on /privacy; '' when unset. */
    public static function privacyContact(Connection $db): string
    {
        return self::get($db, self::PRIVACY_CONTACT) ?? '';
    }

    /** How the game's emails tell players to reach a person. */
    public static function contactHint(Connection $db): string
    {
        $contact = self::privacyContact($db);
        return $contact === '' ? 'reply to this email' : 'write to ' . $contact;
    }
}
