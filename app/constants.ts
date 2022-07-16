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
    {
        text: ICONS.settings  + ' Timezone'
    },
    {
        text: ICONS.settings + ' Digest',
        type: 'digest',
        extraText: `Set days of the week and time when you wish to receive the Digest.` +
            ` You can mute the common channel then, but you still` +
            ` need to be a member of it to be able to use the bot.`,
    },
    {
        text: ICONS.settings  + ' Informal/Formal',
        type: 'informal-formal',
        extraText: `Informal text`,
    },
    {
        text: ICONS.settings  + ' Flags',
        type: 'flags',
        extraText: `flags text`,
    },
    {
        text: ICONS.settings  + ' Comments',
        type: 'comments',
        extraText: `comment text`,
    },
    {
        text: ICONS.settings  + ' Proposals',
        type: 'proposals',
        extraText: `proposals text`,
    },
    {
        text: ICONS.settings  + ' Extra alerts',
        type: 'extra',
        extraText: `extra text`,
    },
    { text: ICONS.home + ' Main Menu' },
];

export const CONTEXTS = [
    'digest',
    'informal-formal',
    'flags',
    'comments',
    'proposals',
    'extra',
];

export const WEEKDAYS = {
    SU: 'sunday',
    MO: 'monday',
    TU: 'tuesday',
    WE: 'wednesday',
    TH: 'thursday',
    FR: 'friday',
    SA: 'saturday',
}

export const MESSAGES = {
    timezone: 'Enter your UTC timezone offset (e.g. -5 for New York, +7 for Bangkok):',
    digestTime: 'Enter the preferred time for a Digest in 24h format (e.g. 14:30):',
    proposal: 'Enter the proposal number for preview:',
}

export const ERRORS = {
    incorrect_proposal: 'Wrong proposal id format. It should be a number.',
    not_found_proposal: 'Unable to find the specified proposal.',
    time_format: 'Wrong time format.',
    timezone: 'Incorrect timezone offset.',
}
