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
    discussions: '☎️',
    completed: '✅',
    home: '🏠',
    proposal: '📝',
    alert: '📣',
    settings: '⚙️',
    flag: '🚩',
    comment: '💬',
    informal_formal: '🔶',
    off: '✖️',
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

export const MAIN_BUTTONS = [
    { text: ICONS.informal + ' Informal' },
    { text: ICONS.formal + ' Formal' },
    { text: ICONS.completed + ' Completed' },
    { text: ICONS.discussions + ' Discussions' },
    { text: ICONS.digest + ' Digest' },
    { text: ICONS.proposal + ' Proposal #' },
    { text: ICONS.settings + ' Settings' },
];

export const ALERTS_BUTTONS = [
    { text: ICONS.simple + ' Digest time' },
    { text: ICONS.informal_formal + ' Informal/Formal' },
    { text: ICONS.flag + ' Flags' },
    { text: ICONS.comment + ' Comments' },
    { text: ICONS.proposal + ' Proposals' },
    { text: ICONS.no_quorum + ' Extra alerts' },
    { text: ICONS.home + ' Main Menu' },
];

export const CONTEXTS = [
  'digest',
];

export const WEEKDAYS = {
    'SU': 'sunday',
    'MO': 'monday',
    'TU': 'tuesday',
    'WE': 'wednesday',
    'TH': 'thursday',
    'FR': 'friday',
    'SA': 'saturday',
}
