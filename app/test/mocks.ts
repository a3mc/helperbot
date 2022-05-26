export const NewSimpleVotesMock = [
    {
        id: 2000001,
        proposalId: 1000001,
        content_type: 'simple',
        result_count: 0,
        updated_at: '2022-05-20T08:10:06.000000Z',
        title: 'Simple proposal 1',
        timeLeft: '23:59:00',
        rate: 52.2,
        total_user_va: 40,
        type: 'informal',
    },
    {
        id: 2000002,
        proposalId: 1000002,
        content_type: 'simple',
        result_count: 0,
        updated_at: '2022-05-20T08:05:06.000000Z',
        title: 'Simple proposal 2',
        timeLeft: '23:55:00',
        rate: 66.2,
        total_user_va: 40,
        type: 'informal',
    },
    {
        id: 2000003,
        proposalId: 1000003,
        content_type: 'simple',
        type: 'formal',
        result_count: 1,
        updated_at: '2022-05-20T08:05:06.000000Z',
        title: 'Simple proposal 3 in Formal',
        timeLeft: '23:55:00',
        rate: 71.5,
        total_user_va: 40,
        total_member: 33,
    }
];

export const DiscussionsMock = [
    {
        id: 4000001,
        proposalId: 3000001,
        type: 'grant',
        approved_at: '2022-05-20T08:10:06.000000Z',
        title: 'Interesting proposal in discussion',
        attestation: {
            rate: 31
        }
    },
    {
        id: 4000002,
        proposalId: 3000002,
        type: 'simple',
        approved_at: '2022-05-20T08:10:06.000000Z',
        title: 'Not so interesting',
        attestation: {
            rate: 10
        }
    },
    {
        id: 4000003,
        proposalId: 3000003,
        type: 'simple',
        approved_at: '2022-05-20T08:10:06.000000Z',
        title: 'Not highly attested but ending soon',
        attestation: {
            rate: 12
        }
    },
    {
        id: 4000004,
        proposalId: 3000004,
        type: 'grant',
        approved_at: '2020-05-20T08:10:06.000000Z',
        title: 'Old and should be removed',
        attestation: {
            rate: 12
        }
    },
];

export const CompletedVotesMock = [
    {
        id: 5000001,
        proposalId: 6000001,
        content_type: 'simple',
        result: 'no-quorum',
        updated_at: '2022-05-20T08:10:06.000000Z',
        title: 'Completed failed with no quorum',
        rate: 52.2,
        total_user_va: 40,
    },
    {
        id: 5000001,
        proposalId: 6000001,
        content_type: 'grant',
        result: 'passed',
        updated_at: '2022-05-20T08:10:06.000000Z',
        title: 'Completed normally',
        rate: 52.2,
        total_user_va: 40,
    },
];
