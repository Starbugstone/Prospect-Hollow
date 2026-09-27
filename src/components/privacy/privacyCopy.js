import { locale } from '../../i18n';

export const PRIVACY_COPY = {
  en: {
    title: 'Advertising & privacy',
    introduction:
      'With your permission, advertising partners may use cookies, similar technologies and information about your device to provide, personalize and measure ads.',
    optional:
      'You can refuse and play normally. Only optional rewards for watching ads depend on advertising being available.',
    placeholder:
      'Live advertising is not available in this version. We will ask again before connecting live advertising; your choice here cannot enable it.',
    mock: 'This version offers test ads only. No advertising partners receive data from these previews.',
    reject: 'Reject all',
    manage: 'Manage choices',
    accept: 'Accept all',
    close: 'Close privacy choices',
    necessary: 'Necessary storage',
    always: 'Always active',
    necessaryDetail:
      'Your village, progress, language, settings and privacy choice stay on this device. When you use an account, a session cookie keeps you signed in.',
    advertising: 'Optional advertising',
    advertisingDetail:
      'Advertising, personalization and ad measurement are kept together in this preview. No separate analytics switch is offered for services that cannot yet honor one.',
    save: 'Save choices',
    policy: 'Privacy & cookie information',
    localData:
      'Playing locally does not require an account. We store your game progress and preferences in your browser so you can return to your village.',
    previewData:
      'This preview stores only your choice, its date and a notice version in local storage. Choices expire after 180 days. Accepting here does not create consent for a live advertising service. You can change your choice at any time in Settings → Privacy choices.',
    accountData:
      'If you create an account, your email address, profile and cloud villages are stored to provide sign-in and save synchronization. You can delete your account from the account settings. Other local villages on this device remain available.',
    plannedPartners:
      'The planned advertising provider is GameMonetize, with partners including Google advertising services. Live advertising may process your IP address, device/browser information, page context, identifiers and ad interactions. Its actual vendors, purposes and storage will be disclosed in the consent platform before live advertising is enabled.',
    policyLimit:
      'Live advertising remains disabled while provider access and the production privacy information are being prepared.',
    providers: 'Provider privacy information',
    unavailable:
      'Advertising privacy controls are unavailable right now. Advertising stays off, and you can keep playing normally. Please try Privacy choices again later.',
    continue: 'Continue playing',
  },
  fr: {
    title: 'Publicité et confidentialité',
    introduction:
      'Avec votre accord, les partenaires publicitaires peuvent utiliser des cookies, des technologies similaires et des informations sur votre appareil pour diffuser, personnaliser et mesurer les publicités.',
    optional:
      'Vous pouvez refuser et jouer normalement. Seules les récompenses facultatives obtenues en regardant une publicité dépendent de la disponibilité des publicités.',
    placeholder:
      'La publicité réelle est indisponible dans cette version. Nous vous redemanderons votre accord avant de la connecter ; votre choix ici ne peut pas l’activer.',
    mock: 'Cette version propose uniquement des publicités de démonstration. Aucun partenaire publicitaire ne reçoit de données issues de ces aperçus.',
    reject: 'Tout refuser',
    manage: 'Gérer mes choix',
    accept: 'Tout accepter',
    close: 'Fermer les choix de confidentialité',
    necessary: 'Stockage nécessaire',
    always: 'Toujours actif',
    necessaryDetail:
      'Votre village, votre progression, votre langue, vos paramètres et votre choix de confidentialité restent sur cet appareil. Si vous utilisez un compte, un cookie de session maintient votre connexion.',
    advertising: 'Publicité facultative',
    advertisingDetail:
      'La publicité, la personnalisation et la mesure publicitaire sont regroupées dans cet aperçu. Aucun réglage statistique distinct n’est proposé pour les services qui ne peuvent pas encore le respecter.',
    save: 'Enregistrer mes choix',
    policy: 'Informations sur la confidentialité et les cookies',
    localData:
      'Aucun compte n’est nécessaire pour jouer en local. Votre progression et vos préférences sont conservées dans votre navigateur pour vous permettre de retrouver votre village.',
    previewData:
      'Cet aperçu conserve uniquement votre choix, sa date et la version de cette notice dans le stockage local. Les choix expirent après 180 jours. Accepter ici ne donne pas votre accord pour un service publicitaire réel. Vous pouvez modifier votre choix à tout moment dans Paramètres → Choix de confidentialité.',
    accountData:
      'Si vous créez un compte, votre adresse e-mail, votre profil et vos villages dans le cloud sont conservés pour assurer la connexion et la synchronisation des sauvegardes. Vous pouvez supprimer votre compte depuis ses paramètres. Les autres villages locaux restent disponibles sur cet appareil.',
    plannedPartners:
      'Le fournisseur publicitaire prévu est GameMonetize, avec des partenaires dont les services publicitaires de Google. La publicité réelle peut traiter votre adresse IP, les informations sur votre appareil et votre navigateur, le contexte de la page, des identifiants et vos interactions publicitaires. Les fournisseurs, finalités et stockages effectivement utilisés seront présentés dans la plateforme de consentement avant toute activation.',
    policyLimit:
      'La publicité réelle reste désactivée pendant la préparation des accès aux fournisseurs et des informations de confidentialité pour la mise en production.',
    providers: 'Informations de confidentialité des fournisseurs',
    unavailable:
      'Les réglages de confidentialité publicitaire sont indisponibles pour le moment. La publicité reste désactivée et vous pouvez continuer à jouer normalement. Réessayez plus tard depuis les choix de confidentialité.',
    continue: 'Continuer à jouer',
  },
};

export const privacyCopy = () => PRIVACY_COPY[locale.value] ?? PRIVACY_COPY.en;
