import { ApiClient } from './api-client';
import moment from 'moment';
import { DbClient } from './db-client';
import { ICONS, POST_TYPES, VOTE_TYPES } from './constants';

// Class to collect data and generate post messages.
export class Digest {
    public apiClient = new ApiClient();
    protected dbClient = new DbClient();

    // Main method to create a Daily Digest. It fetches the data from the API, passes it to the methods that generate
    // text and return a resulting text to post.
    async createDigest(): Promise<string> {
        // Here we get all the proposals from different endpoints.
        const informal = await this.informalVotes();
        const formal = await this.formalVotes();
        const discussions = await this.discussions();
        const completed = ( await this.completedVotes() ).filter(
            vote => moment( vote.updated_at ).utc().isAfter( moment().utc().add( -24, 'hours' ) )
        );

        // Pass proposals to the methods that generate text to form the final Digest text.
        return [
            this.endingVotesText( this.endingSoon( informal ), 'informal' ),
            this.endingVotesText( this.endingSoon( formal ), 'formal' ),
            this.recentlyCompletedText( completed ),
            this.discussionsText( discussions ),
        ].join( '' );
    }

    // A dedicated method just to get votes of "simple" and "admin-grant" types to make a separate post,
    // as these votes a short-living and may require additional attention. Returns a string with the post text.
    async listSimpleAdmin(): Promise<string> {
        const informal = ( await this.informalVotes() ).filter(
            vote => vote.content_type === 'simple' || vote.content_type === 'admin-grant'
        );
        const formal = ( await this.formalVotes() ).filter(
            vote => vote.content_type === 'simple' || vote.content_type === 'admin-grant'
        );

        // We just use active informal and formal of these types.
        return [
            this.simpleAdminVotesText( informal, 'informal' ),
            this.simpleAdminVotesText( formal, 'formal' ),
        ].join( '' );
    }

    // When a proposal enters a new phase (Informal or Formal) we make a post about that immediately.
    // "proposalMode" is a flag to filter proposals based on user's preferences.
    async newProposal( chatId = 0, proposalMode = false ): Promise<any> {
        const informal = ( await this.informalVotes() );
        const formal = ( await this.formalVotes() );
        let newInformal = [];
        let newFormal = [];

        // Check if posts for the votes were already made.
        // Ids and post types are stored in the database, so we don't make the same announcement twice.
        for ( const vote of informal ) {
            if ( !await this.dbClient.checkPost( vote.id, VOTE_TYPES.informal, POST_TYPES.new_simple, chatId ) ) {
                if ( proposalMode ) {
                    const proposalsIds: number[] = await this.dbClient.getProposals( chatId );
                    if ( proposalsIds.includes( vote.proposal_id ) ) {
                        newInformal.push( vote );
                    }
                } else {
                    newInformal.push( vote );
                }
            }
        }
        for ( const vote of formal ) {
            if ( !await this.dbClient.checkPost( vote.id, VOTE_TYPES.formal, POST_TYPES.new_simple, chatId ) ) {
                if ( proposalMode ) {
                    const proposalsIds: number[] = await this.dbClient.getProposals( chatId );
                    if ( proposalsIds.includes( vote.proposal_id ) ) {
                        newFormal.push( vote );
                    }
                } else {
                    newFormal.push( vote );
                }
            }
        }

        // As we store the made posts in database only if the post was successful, here we return ids and the formed
        // text separately. As the post itself happens in index.ts, we write to the database there.
        return {
            informalIds: newInformal.map( vote => vote.id ),
            formalIds: newFormal.map( vote => vote.id ),
            text: [
                this.simpleAdminVotesText( newInformal, 'informal', true ),
                this.simpleAdminVotesText( newFormal, 'formal', true ),
            ].join( '' )
        }
    }

    // Votes of these types (simple/admin-grant) are very important and easy to miss for the VAs due to their short
    // duration (24h). And if such posts ends soon and has no quorum, we make an extra post about that.
    async expiringSimpleAdminNoQuorum(): Promise<any> {
        // SIMPLE_NO_QUORUM_ALERT defines the time when the post should be made, before it expires.
        const informal = this.endingSoon( ( await this.informalVotes() ).filter(
            vote => vote.content_type === 'simple' || vote.content_type === 'admin-grant'
        ), process.env.SIMPLE_NO_QUORUM_ALERT );
        const formal = this.endingSoon( ( await this.formalVotes() ).filter(
            vote => vote.content_type === 'simple' || vote.content_type === 'admin-grant'
        ), process.env.SIMPLE_NO_QUORUM_ALERT );

        let newInformal = [];
        let newFormal = [];

        // Check if posts for the votes were already made.
        for ( const vote of informal ) {
            if ( !await this.dbClient.checkPost( vote.id, VOTE_TYPES.informal, POST_TYPES.expiring_simple ) ) {
                newInformal.push( vote );
            }
        }
        for ( const vote of formal ) {
            if ( !await this.dbClient.checkPost( vote.id, VOTE_TYPES.formal, POST_TYPES.expiring_simple ) ) {
                newFormal.push( vote );
            }
        }

        // We return separately ids and the formatted text, so we can save ids only when post really happened.
        return {
            informalIds: newInformal.map( vote => vote.id ),
            formalIds: newFormal.map( vote => vote.id ),
            text: [
                this.endingVotesText( newInformal, 'informal' ),
                this.endingVotesText( newFormal, 'formal' ),
            ].join( '' )
        }
    }

    // As the situation when proposal fails because of no quorum, and we want to avoid it at all cost - we make
    // a post if it happens. We check completed votes without a quorum.
    async newFailedNoQuorum(): Promise<any> {
        const noQuorum = ( await this.completedVotes() ).filter( vote => vote.result === 'no-quorum' );
        let newNoQuorum = [];

        // Check if posts for the votes were already made.
        for ( const vote of noQuorum ) {
            if ( !await this.dbClient.checkFailedPost( vote.id ) ) {
                newNoQuorum.push( vote );
            }
        }

        // We return ids and text separately, so ids can be saved to database only when post is made.
        return {
            votesIds: newNoQuorum.map( vote => vote.id ),
            text: this.failedNoQuorumText( newNoQuorum )
        }
    }

    // Get the active Informal votes from the API.
    async informalVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.INFORMAL_SORTED_URL );
        return result.votes;
    }

    // Get the active Formal votes from the API.
    async formalVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.FORMAL_SORTED_URL );
        return result.votes;
    }

    // Get the completed votes from the API. It includes both informal and formal and the limit is set inside the URL.
    async completedVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.COMPLETED_SORTED_URL );
        return result.votes;
    }

    // Get proposals from the active discussions.
    async discussions(): Promise<any> {
        const result = await this.apiClient.get( process.env.DISCUSSIONS_URL );
        return result.proposals;
    }

    // A helper method to generate text for simple/admin votes.
    // "newVote" is passed when we make a post about the proposal that just entered a new phase, so the title is
    // slightly different.
    simpleAdminVotesText( votes: any[], voteType: string, newVote = false ): string {
        let text = '';
        if ( votes.length ) {
            if ( newVote ) {
                text += ICONS[voteType] + ` __\*${ votes.length } new proposal* ` +
                    `just entered \_${ voteType.toUpperCase() }_:__\n\n`;
            } else {
                text += `${ ICONS[voteType] } __\*${ votes.length }* in` +
                    ` ${ voteType.toUpperCase() }__\n\n`;
            }
            // Once title is formed, we go through each vote to generate a line of text for it.
            // Passed parameters have effect on the formatting of these lines.
            for ( const vote of votes ) {
                text += this.voteToText( vote, !newVote, false, true );
            }
        }
        return text;
    }

    // A method to generate text for the completed votes.
    recentlyCompletedText( votes: any[] ): string {
        let text = '';
        if ( votes.length ) {
            text = ICONS.completed + ' __Recently completed__\n\n';
            // And here we form the list of the votes.
            for ( const vote of votes ) {
                text += this.voteToText( vote, false, true );
            }
        }
        return text;
    }

    // Generate title for the failed with no quorum, and the list of the votes that failed.
    failedNoQuorumText( votes: any[] ): string {
        let text = '';
        if ( votes.length ) {
            text += ICONS.no_quorum + ` __\*${ votes.length } failed without a quorum:*__\n\n`;
            for ( const vote of votes ) {
                text += this.voteToText( vote, false );
            }
        }
        return text;
    }

    // Filter the  passed discussions and create text that may consist of a few parts.
    discussionsText( discussions: any[] ): string {
        let text = '';

        // These discussions have high attestation rate and may require attention.
        // The threshold is defined in ATTESTATION_INTEREST and we don't need to post about discussion that has low rate.
        const interestingDiscussions = discussions.filter(
            // Discussions older than 90 days are inactive and don't count.
            discussion =>
                moment( discussion.approved_at ).utc().isAfter( moment().utc().add( -90, 'days' ) ) &&
                Number( discussion.attestation.rate ) >= Number( process.env.ATTESTATION_INTEREST ) &&
                // Sometimes discussion can reach 51% and that means it will enter informal voting soon.
                discussion.attestation.rate < 51
        ).sort( ( a: any, b: any ) => {
            // Sort by descending attestation rate.
            if ( a.attestation.rate > b.attestation.rate ) return -1;
            if ( a.attestation.rate < b.attestation.rate ) return 1;
            return 0;
        } );
        // If we have something to display, create a title and process the list.
        if ( interestingDiscussions.length ) {
            const multiple = interestingDiscussions.length > 1;
            text += ICONS.interest + ` __\*${ interestingDiscussions.length } ` +
                `discussion${ multiple ? 's' : '' }* require attention:__\n\n`;

            // Create a line of text for each of these discussions.
            for ( const discussion of interestingDiscussions ) {
                text += this.discussionToText( discussion );
            }
        }

        // These discussions have less than 1 week before the 90-days limit hits. As they will become inactive soon,
        // probably they just have some last chance to gather some attention.
        const endingDiscussions = discussions.filter(
            discussion =>
                moment( discussion.approved_at ).utc().isAfter( moment().utc().add( -90, 'days' ) ) &&
                moment( discussion.approved_at ).utc().isBefore(
                    moment().utc().add( -90 + Number( process.env.ENDING_DAYS ), 'days' )
                )
        );
        if ( endingDiscussions.length ) {
            // Form the title.
            const multiple = endingDiscussions.length > 1;
            text += ICONS.ending + ` __\*${ endingDiscussions.length } discussion${ multiple ? 's' : '' }* ` +
                `${ multiple ? 'are' : 'is' } ending within ${ process.env.ENDING_DAYS } days:__\n\n`;

            // And the list of such discussions.
            for ( const discussion of endingDiscussions ) {
                text += this.discussionToText( discussion );
            }
        }

        // These discussions are older than 90 days and should be removed by the admins as they are no longer active.
        // It's just a reminder for a cleanup.
        const deadDiscussions = discussions.filter(
            discussion => moment( discussion.approved_at ).utc()
                .isBefore( moment().utc().add( -90, 'days' ) )
        );
        if ( deadDiscussions.length ) {
            // We don't want to list all dead discussions, so just returning the overall amount of them.
            const multiple = deadDiscussions.length > 1;
            text += ICONS.dead + ` __There ${ multiple ? 'are' : 'is' } \*${ deadDiscussions.length } ` +
                `discussion${ multiple ? 's' : '' }* older than 90 days__\\.\n\n`;
        }
        return text;
    }

    // Generate text for ending votes with no quorum.
    endingVotesText( ending: any[], voteType: string ): string {
        let text = '';
        if ( ending.length ) {
            text += ICONS[voteType] + ` ${ ending.length } in __ ${ voteType.toUpperCase() }` +
                ` \*\\- no quorum:*__\n\n`;
            // And create a line for each of them.
            for ( const vote of ending ) {
                text += this.voteToText( vote );
            }
        }
        return text;
    }

    // This method creates a line of text (following Telegram Markdown v.2 rules).
    // It accepts a few parameters that affect the formatting.
    // "full" is used when we want to display the time left, "result" for completed votes, and "new when it just entered
    // a new phase.
    voteToText( vote: any, full = true, result = false, isNew = false ): string {
        const title = '"' + this.escapeText( vote.title ) + '"';
        const contentType = this.escapeText( vote.content_type );
        const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + vote.proposalId;

        // We get the number of users from the settings for informal votes, and from the vote property for formal,
        // due to the difference in how quorum is calculated for these types of votes.
        const totalUsers = vote.type === 'informal' ? this.apiClient.totalMembers : vote.total_member;

        // Add a link to the proposal and the title.
        let text = `[\\#${ vote.proposalId }](${ link }) \_${ contentType }_: ${ title }`;

        if ( full ) {
            // It's not needed for new or completed votes, but good for active ones.
            // We also make some time conversion to display it in a more readable way.
            text += `\n\\(\_${ vote.result_count }/${ totalUsers } voted_\\. ` +
                `\_Time left: ` + this.timeLeftToHM( vote.timeLeft ) + `_\\)`;

        } else if ( isNew ) {
            // New votes always have the same time left, and nobody voted for them yet.
            // So we just need to tell when they end.
            const timeLeft = vote.timeLeft.substring( 0, 5 ).split( ':' );
            const endDate = moment().utc()
                .add( parseInt( timeLeft[0] ), 'hours' )
                .add( parseInt( timeLeft[1] ), 'minutes' )
                .format( 'D MMM HH:mm' );

            text += `\n\\(\_End: ${ this.escapeText( endDate ) } UTC_\\)`;
        }

        if ( result ) {
            // That's for completed votes, to show the result of the voting.
            text += `: \*${ this.escapeText( vote.result.toUpperCase() ) }* \_${ vote.type }_`;
        }

        text += `\n\n`;``
        return text;
    }

    // Generate text line (Markdown 2) for each discussion passed here.
    discussionToText( discussion: any ): string {
        const title = '"' + this.escapeText( discussion.title ) + '"';
        const contentType = this.escapeText( discussion.type );
        const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + discussion.id;
        const attestationRate = this.escapeText(
            String( Math.round( discussion.attestation.rate * 100 ) / 100 )
        );
        const approvedAt = this.escapeText( discussion.approved_at.substring( 0, 10 ) );

        // We calculate how many attestations the discussion needs to reach 51% and to get to Informal,
        // So if just only one or two attestations are needed we format it differently to bring extra attention.
        const votesForQuorum = Math.ceil( 51 / 100 * this.apiClient.totalMembers );
        const voted = Math.floor( discussion.attestation.rate / 100 * this.apiClient.totalMembers );
        const votesNeeded = votesForQuorum - voted;
        const icon = votesForQuorum - voted < 3 ? ICONS.alert +
            ` \*${ votesNeeded } attestation${ votesNeeded > 1 ? 's' : '' } needed\\!*\n` : null;

        return ( icon ? icon + ' ' : '' ) + `[\\#${ discussion.id }](${ link }) ` +
            `\_${ contentType }_: ${ title }\n` +
            `\\(\_Att\\. rate:_ \*${ attestationRate }%* ` +
            `\_Approved:_ ${ approvedAt }\\)\n\n`;
    }

    // Transform the time left to another form that is easier to compare.
    // Basically it just concatenates all numbers here, that is enough to compare.
    timeLeftToSeconds( timeLeft: string ): number {
        return Number( timeLeft.split( ':' ).join( '' ) );
    }

    // Format time to a more readable string.
    timeLeftToHM( timeLeft: string ): string {
        return timeLeft.substring( 0, 5 ).replace( /:/, 'h ' ) + 'm';
    }

    endingSoon( votes: any[], soon = process.env.SOON_TIMESPAN ): any[] {
        // To prevent errors if introducing a new content_type or vote type we check it inside the loop for each vote.
        // Each quorum rate is usually around 51%, it may differ, so we take it from the settings to be sure.
        return votes.filter( vote => {
            let quorumRate: number;
            if ( vote.content_type === 'milestone' ) {
                quorumRate = this.apiClient.quorumRateMilestone;
            } else if ( vote.content_type === 'grant' || vote.content_type === 'admin-grant' ) {
                quorumRate = this.apiClient.quorumRate;
            } else if ( vote.content_type === 'simple' ) {
                quorumRate = this.apiClient.quorumRateSimple;
            } else {
                return false;
            }

            // All VAs vote for informal, and only those who voted for informal vote in formal.
            const members = vote.type === 'informal' ? this.apiClient.totalMembers : vote.total_member;

            // Return a vote if it ends within given time interval and didn't reach the quorum rate yet.
            return this.timeLeftToSeconds( vote.timeLeft ) < Number( soon + '0000' ) &&
                ( vote.result_count / members ) * 100 < quorumRate;
        } );
    }

    // Telegram Markdown v2 requires some characters to be escaped.
    escapeText( text: string ): string {
        return text
            .replace( /_/g, '\\_' )
            .replace( /\*/g, '\\*' )
            .replace( /\[/g, '\\[' )
            .replace( /]/g, '\\]' )
            .replace( /\(/g, '\\(' )
            .replace( /\)/g, '\\)' )
            .replace( /~/g, '\\~' )
            .replace( /`/g, '\\`' )
            .replace( />/g, '\\>' )
            .replace( /#/g, '\\#' )
            .replace( /\+/g, '\\+' )
            .replace( /-/g, '\\-' )
            .replace( /=/g, '\\=' )
            .replace( /\|/g, '\\|' )
            .replace( /{/g, '\\{' )
            .replace( /}/g, '\\}' )
            .replace( /\./g, '\\.' )
            .replace( /!/g, '\\!' );
    }
}
