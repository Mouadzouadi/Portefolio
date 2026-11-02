/**
 * Démo vocale : réglages publics (aucun secret).
 * Les agents Retell et leurs textes sont côté serveur (api/use-cases.php) ; la page n'envoie que la clé du cas d'usage.
 */

/** Endpoint PHP du site qui crée l'appel Retell et renvoie l'access_token. */
export const ENDPOINT = 'api/retell-web-call.php';

/** SDK Retell, version figée (une nouvelle version majeure peut changer l'API). */
export const RETELL_SDK_URL = 'https://esm.sh/retell-client-js-sdk@2.0.8';

/** Un bouton par cas d'usage ; mêmes clés que api/use-cases.php. Le premier est sélectionné par défaut. */
export const USE_CASES = {
  fastfood: { label: 'Restaurant', shopName: 'Restaurant — prise de commande' },
  coiffeur: { label: 'Coiffeur', shopName: 'Salon de coiffure — prise de rendez-vous' },
  auto: { label: 'Garage', shopName: 'Garage automobile — diagnostic et rendez-vous' },
};
