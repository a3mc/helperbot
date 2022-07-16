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
    },
    {
        text: ICONS.settings  + ' Informal/Formal',
        type: 'informal-formal',
        extraText: 'You will receive a message once any proposal enters the Informal or Formal voting stage.'
    },
    {
        text: ICONS.settings  + ' Flags',
        type: 'flags',
    },
    {
        text: ICONS.settings  + ' Comments',
        type: 'comments',
    },
    {
        text: ICONS.settings  + ' Proposals',
        type: 'proposals',
        extraText: `You can receive all updates only on selected proposals. Click "Add #" to add a proposal by ` +
            `its number of "Remove #" to remove it from the watching list.`
    },
    {
        text: ICONS.settings  + ' Extra alerts',
        type: 'extra',
        extraText: `Extra alerts include warning messages of expiring simple/admin votes without a quorum, etc.`,
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
    add_proposal: 'Enter the proposal number to add to the watching list:',
    remove_proposal: 'Enter the proposal number to remove from the watching list:',
    no_proposals: 'You are not subscribed to any proposals yet.',
    proposals_ids: 'Proposals you are currently subscribed to: ',
    main_menu: 'Select an option for an instant update or Settings to customize the notifications:',
    settings_menu: `Set up your timezone, or configure when you prefer to receive` +
        ` updates for each notification type:`,
    calendar_menu: 'Select on which weekdays you wish to receive updates for',
}

export const ERRORS = {
    incorrect_proposal: 'Wrong proposal id format. It should be a number.',
    not_found_proposal: 'Unable to find the specified proposal.',
    existing_proposal: 'This proposal is already in the list.',
    time_format: 'Wrong time format.',
    timezone: 'Incorrect timezone offset.',
    no_context: 'Wrong context for %d',
}
