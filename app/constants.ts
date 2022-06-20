// Icons to be used in messages.
export const ICONS = {
    dead: '☠️',
    ending: '⏳',
    interest: '👀',
    attention: '⚠',
    simple: '🕓',
    new_simple: '📩',
    no_quorum: '🔥',
    informal: '🟦',
    formal: '🟩',
    digest: '📋',
    completed: '✅',
    alert: '📣',
};

// Post types that are stored in the database.
export const POST_TYPES = {
    digest: 0,
    active_simple: 1,
    new_simple: 2,
    failed_no_quorum: 3,
    expiring_simple: 4,
};

// Type of the vote, used to work with the database.
export const VOTE_TYPES = {
    informal: 0,
    formal: 1,
};
