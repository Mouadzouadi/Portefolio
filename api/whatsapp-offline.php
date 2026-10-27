<?php
/**
 * Réponse de secours de la démo WhatsApp, hébergée avec le site.
 *
 * À renseigner comme « Fallback URL » de l'expéditeur WhatsApp chez Twilio :
 * Twilio l'appelle seulement quand le bot principal (n8n) ne répond pas,
 * par exemple quand le poste qui l'héberge est éteint. Le prospect reçoit
 * alors un message clair au lieu d'un silence.
 */
header('Content-Type: text/xml; charset=utf-8');
header('Cache-Control: no-store');
$text = "Merci pour votre message 🙏 La démonstration WhatsApp de ZM Solutions est en pause pour quelques instants. "
      . "Réessayez un peu plus tard, ou écrivez-moi : je vous montre la démo en direct. Mouad, ZM Solutions";
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<Response><Message>' . htmlspecialchars($text, ENT_XML1, 'UTF-8') . '</Message></Response>';
