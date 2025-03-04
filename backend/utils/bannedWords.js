/**
 * Banned words and patterns organized by category
 * These will trigger an immediate failure without running other checks
 */
const bannedWords = {
    adult: [
        'porn', 'xxx', 'adult', 'sex', 'nude', 'naked', 'pussy', 'dick', 
        'cock', 'tits', 'boobs', 'ass', 'anal', 'milf', 'mature'
    ],
    
    drugs: [
        'cannabis', 'marijuana', 'weed', 'cocaine', 'heroin', 'meth',
        'mdma', 'ecstasy', 'lsd', 'shrooms', 'psychedelics', 'drugs'
    ],
    
    gambling: [
        'casino', 'poker', 'bet', 'betting', 'slots', 'gambling', 
        'lottery', 'roulette', 'blackjack'
    ],
    
    weapons: [
        'guns', 'firearms', 'weapons', 'ammo', 'ammunition', 
        'rifle', 'pistol', 'shotgun'
    ],
    
    punycode: [
        'xn--'  // Punycode prefix
    ],
    
    malicious: [
        'phishing', 'malware', 'trojan', 'virus', 'hack', 
        'crack', 'keygen', 'warez', 'torrent', 'pirate'
    ],
    
    // Banned Top-Level Domains (TLDs)
    bannedTLDs: [
        // Middle East
        'af',  // Afghanistan
        'ir',  // Iran
        'iq',  // Iraq
        'lb',  // Lebanon
        'ly',  // Libya
        'ps',  // Palestine
        'sy',  // Syria
        'ye',  // Yemen

        // Asia
        'bd',  // Bangladesh
        'kh',  // Cambodia
        'id',  // Indonesia
        'la',  // Laos
        'my',  // Malaysia
        'mm',  // Myanmar
        'kp',  // North Korea
        'pk',  // Pakistan
        'th',  // Thailand
        'vn',  // Vietnam

        // Africa
        'bi',  // Burundi
        'cf',  // Central African Republic
        'cd',  // Democratic Republic of the Congo
        'lr',  // Liberia
        'ma',  // Morocco
        'so',  // Somalia
        'ss',  // South Sudan
        'sd',  // Sudan
        'tn',  // Tunisia
        'zw',  // Zimbabwe

        // Europe
        'bg',  // Bulgaria
        'cy',  // Cyprus
        'mt',  // Malta
        'rs',  // Serbia
        'ru',  // Russia

        // Americas
        'cu',  // Cuba
        'ni',  // Nicaragua
        've'   // Venezuela
    ]
};

module.exports = bannedWords; 