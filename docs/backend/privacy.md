# Privacy and player data (GDPR)

Players can see, download, correct and delete everything the server keeps about them,
without writing to anyone. The public notice lives at `/privacy`; the controls live in the
**Mayor's Office**, the account view of the account panel (Settings → Mayor's Office, or
the user icon in My towns).

## Where the pieces are

| Need                         | Player-facing                                                | Server                                                                                       |
| ---------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Information (articles 13–14) | `/privacy` (`src/components/privacy/PrivacyPage.vue`)        | Content and retention in `src/data/privacy.js`                                               |
| Access                       | Mayor's Office → Your data                                   | `GET /api/v1/account/data` (`PlayerData::summary`)                                           |
| Portability                  | Download account data / This device only                     | `GET /api/v1/account/export` (`PlayerData::export`); the device file is built in the browser |
| Rectification                | Mayor's Office → Profile: public name, private visits, email | `PATCH account/profile`, `POST account/email` and `POST account/email/confirm`               |
| Erasure                      | Mayor's Office → Delete                                      | `DELETE /api/v1/account` and the admin panel, both via `SaveService::eraseAccount`           |

## Erasure

`SaveService::eraseAccount` is the only way an account is deleted, for the player and for
admins. In one transaction holding the player row lock it:

1. Anonymises the player's visits in other guestbooks: name and home town are cleared and
   every visit of the account gets **one** new random `visitor_key`. Hosts keep their
   `uniqueVisitors` count (each erased visitor still counts once, because the visits share
   the new key) while nothing links the visits to the account any more.
2. Deletes pending sign-in links and the email's `identities` row.
3. Deletes the player; cascades remove towns, history, sessions, profile, activity,
   distinctions, revocations, favourites and pending email changes.

After the commit the old address gets one last email; the admin audit log keeps only the
account ID. A visit counts as signed in because `visitor_visits.signed_in` was set when it
was recorded, not because it still has a name or home town, so erasure, a private visit
or a deleted home town never lowers another player's counts or honours. Travels (the
villages a town visited, for Explorer honours) are kept in `town_travels` with the
visiting town, so deleting a village or erasing its owner never lowers a visitor's count.
A deleted home town's name stays in guestbooks, marked as a former town, until the
visitor's account is erased.

`backend/bin/cleanup.php` also removes expired email change links and identity rows left
by accounts deleted before erasure removed them.

Other devices keep their offline copy until the player removes it there: once the
sessions are gone, a device sees an expired session, and nothing on the server can tell
it that the account was deleted.

## Email change

`POST account/email` stores a hashed token for one hour and mails `/#email=<token>` to the
new address. Opening it (on any device, signed in or not) calls `account/email/confirm`,
which takes the player row lock and then the new address's identity lock, as a first
sign-in does, refuses an address another account uses, and tells the old address.

## Keeping the notice true

`testing/player-data.test.js` fails when the notice promises a retention the code does
not enforce (sign-in and email change links, sessions, active days, deleted towns, earlier
saves) or when a notice or Mayor's Office string has no French text. When you add personal
data, add a row to `PRIVACY_DATA`, include it in the export and overview, make sure
erasure removes it, and raise `PRIVACY_UPDATED`.

Operator settings:

- `VITE_PRIVACY_CONTACT` (build time) shows a contact address on the notice. Without it,
  the notice asks players to reply to any game email, so `MAIL_FROM` must reach a
  monitored mailbox.
- `RETENTION.hostRecords` states how long the host keeps web server logs and backups;
  keep it in line with the hosting plan and any database dumps you keep yourself.
