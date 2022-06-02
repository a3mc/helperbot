import { ApiClient } from './api-client';
import moment from 'moment';
import { DbClient } from './db-client';
import { ICONS, POST_TYPES, VOTE_TYPES } from './constants';

export class Digest {
    protected apiClient = new ApiClient();
    protected dbClient = new DbClient();

    async createDigest(): Promise<any> {
        const informal = await this.informalVotes();
        const formal = await this.formalVotes();
        const discussions = await this.discussions();
        const completed = ( await this.completedVotes() ).filter(
            vote => moment( vote.updated_at ).utc().isAfter( moment().utc().add( -24, 'hours' ) )
        );

        return [
            this.endingVotesText( this.endingSoon( informal ), 'informal' ),
            this.endingVotesText( this.endingSoon( formal ), 'formal' ),
            this.recentlyCompletedText( completed ),
            this.discussionsText( discussions ),
        ].join( '' );
    }

    async listSimpleAdmin(): Promise<any> {
        const informal = ( await this.informalVotes() ).filter(
            vote => vote.content_type === 'simple' || vote.content_type === 'admin-grant'
        );
        const formal = ( await this.formalVotes() ).filter(
            vote => vote.content_type === 'simple' || vote.content_type === 'admin-grant'
        );

        return [
            this.simpleAdminVotesText( informal, 'informal' ),
            this.simpleAdminVotesText( formal, 'formal' ),
        ].join( '' );
    }

    async newProposal(): Promise<any> {
        const informal = ( await this.informalVotes() );
        const formal = ( await this.formalVotes() );
        let newInformal = [];
        let newFormal = [];

        // Check if posts for the votes were already made.
        for ( const vote of informal ) {
            if ( !await this.dbClient.checkPost( vote.id, VOTE_TYPES.informal ) ) {
                newInformal.push( vote );
            }
        }
        for ( const vote of formal ) {
            if ( !await this.dbClient.checkPost( vote.id, VOTE_TYPES.formal ) ) {
                newFormal.push( vote );
            }
        }

        return {
            informalIds: newInformal.map( vote => vote.id ),
            formalIds: newFormal.map( vote => vote.id ),
            text: [
                this.simpleAdminVotesText( newInformal, 'informal', true ),
                this.simpleAdminVotesText( newFormal, 'formal', true ),
            ].join( '' )
        }
    }

    async expiringSimpleAdminNoQuorum(): Promise<any> {
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

        return {
            informalIds: newInformal.map( vote => vote.id ),
            formalIds: newFormal.map( vote => vote.id ),
            text: [
                this.endingVotesText( newInformal, 'informal' ),
                this.endingVotesText( newFormal, 'formal' ),
            ].join( '' )
        }
    }

    async newFailedNoQuorum(): Promise<any> {
        const noQuorum = ( await this.completedVotes() ).filter( vote => vote.result === 'no-quorum' );
        let newNoQuorum = [];

        // Check if posts for the votes were already made.
        for ( const vote of noQuorum ) {
            if ( !await this.dbClient.checkFailedPost( vote.id ) ) {
                newNoQuorum.push( vote );
            }
        }

        return {
            votesIds: newNoQuorum.map( vote => vote.id ),
            text: this.failedNoQuorumText( newNoQuorum )
        }
    }

    async informalVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.INFORMAL_SORTED_URL );
        return result.votes;
    }

    async formalVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.FORMAL_SORTED_URL );
        return result.votes;
    }

    async completedVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.COMPLETED_SORTED_URL );
        return result.votes;
    }

    async discussions(): Promise<any> {
        const result = await this.apiClient.get( process.env.DISCUSSIONS_URL );
        return result.proposals;
    }

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
            for ( const vote of votes ) {
                text += this.voteToText( vote, !newVote, false, true );
            }
        }
        return text;
    }

    recentlyCompletedText( votes: any[] ): string {
        let text = '';
        if ( votes.length ) {
            text = ICONS.completed + ' __Recently completed__\n\n';
            for ( const vote of votes ) {
                text += this.voteToText( vote, false, true );
            }
        }
        return text;
    }

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

    discussionsText( discussions: any[] ): string {
        let text = '';

        // These discussions have high attestation rate and may require attention.
        const interestingDiscussions = discussions.filter(
            discussion =>
                moment( discussion.approved_at ).utc().isAfter( moment().utc().add( -90, 'days' ) ) &&
                Number( discussion.attestation.rate ) >= Number( process.env.ATTESTATION_INTEREST ) &&
                discussion.attestation.rate < 51
        ).sort( ( a: any, b: any ) => {
            if ( a.attestation.rate > b.attestation.rate ) return -1;
            if ( a.attestation.rate < b.attestation.rate ) return 1;
            return 0;
        } );
        if ( interestingDiscussions.length ) {
            const multiple = interestingDiscussions.length > 1;
            text += ICONS.interest + ` __\*${ interestingDiscussions.length } ` +
                `discussion${ multiple ? 's' : '' }* require attention:__\n\n`;

            for ( const discussion of interestingDiscussions ) {
                text += this.discussionToText( discussion );
            }
        }

        // These discussions have less than 1 week before the 90-days limit hits.
        const endingDiscussions = discussions.filter(
            discussion =>
                moment( discussion.approved_at ).utc().isAfter( moment().utc().add( -90, 'days' ) ) &&
                moment( discussion.approved_at ).utc().isBefore(
                    moment().utc().add( -90 + Number( process.env.ENDING_DAYS ), 'days' )
                )
        );
        if ( endingDiscussions.length ) {
            const multiple = endingDiscussions.length > 1;
            text += ICONS.ending + ` __\*${ endingDiscussions.length } discussion${ multiple ? 's' : '' }* ` +
                `${ multiple ? 'are' : 'is' } ending within ${ process.env.ENDING_DAYS } days:__\n\n`;

            for ( const discussion of endingDiscussions ) {
                text += this.discussionToText( discussion );
            }
        }

        // These discussions should be removed as they are no longer active.
        const deadDiscussions = discussions.filter(
            discussion => moment( discussion.approved_at ).utc()
                .isBefore( moment().utc().add( -90, 'days' ) )
        );
        if ( deadDiscussions.length ) {
            const multiple = deadDiscussions.length > 1;
            text += ICONS.dead + ` __There ${ multiple ? 'are' : 'is' } \*${ deadDiscussions.length } ` +
                `discussion${ multiple ? 's' : '' }* older than 90 days__\\.\n\n`;
        }
        return text;
    }

    endingVotesText( ending: any[], voteType: string ): string {
        let text = '';
        if ( ending.length ) {
            text += ICONS[voteType] + ` ${ ending.length } in __ ${ voteType.toUpperCase() }` +
                ` \*\\- no quorum:*__\n\n`;
            for ( const vote of ending ) {
                text += this.voteToText( vote );
            }
        }
        return text;
    }

    voteToText( vote: any, full = true, result = false, isNew = false ): string {
        const title = '"' + this.escapeText( vote.title ) + '"';
        const contentType = this.escapeText( vote.content_type );
        const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + vote.proposalId;
        const totalUsers = vote.type === 'informal' ? this.apiClient.totalMembers : vote.total_member;

        let text = `[\\#${ vote.proposalId }](${ link }) \_${ contentType }_: ${ title }`;

        if ( full ) {
            text += `\n\\(\_${ vote.result_count }/${ totalUsers } voted_\\. ` +
                `\_Time left: ` + this.timeLeftToHM( vote.timeLeft ) + `_\\)`;

        } else if ( isNew ) {
            const timeLeft = vote.timeLeft.substring( 0, 5 ).split( ':' );
            const endDate = moment().utc()
                .add( parseInt( timeLeft[0] ), 'hours' )
                .add( parseInt( timeLeft[1] ), 'minutes' )
                .format( 'D MMM HH:mm' );

            text += `\n\\(\_End: ${ this.escapeText( endDate ) } UTC_\\)`;
        }

        if ( result ) {
            text += `: \*${ vote.result.toUpperCase() }* \_${ vote.type }_`;
        }

        text += `\n\n`;
        return text;
    }

    discussionToText( discussion: any ): string {
        const title = '"' + this.escapeText( discussion.title ) + '"';
        const contentType = this.escapeText( discussion.type );
        const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + discussion.id;
        const attestationRate = this.escapeText(
            String( Math.round( discussion.attestation.rate * 100 ) / 100 )
        );
        const approvedAt = this.escapeText( discussion.approved_at.substring( 0, 10 ) );

        const votesForQuorum = Math.ceil( 51 / 100 * this.apiClient.totalMembers );
        const voted = Math.round( discussion.attestation.rate / 100 * this.apiClient.totalMembers );
        const votesNeeded = votesForQuorum - voted;
        const icon = votesForQuorum - voted < 3 ? ICONS.alert +
            ` \*${ votesNeeded } vote${ votesNeeded > 1 ? 's' : '' } needed\\!*\n` : null;

        return ( icon ? icon + ' ' : '' ) + `[\\#${ discussion.id }](${ link }) ` +
            `\_${ contentType }_: ${ title }\n` +
            `\\(\_Att\\. rate:_ \*${ attestationRate }%* ` +
            `\_Approved:_ ${ approvedAt }\\)\n\n`;
    }

    timeLeftToSeconds( timeLeft: string ): number {
        return Number( timeLeft.split( ':' ).join( '' ) );
    }

    timeLeftToHM( timeLeft: string ): string {
        return timeLeft.substring( 0, 5 ).replace( /:/, 'h ' ) + 'm';
    }

    endingSoon( votes: any[], soon = process.env.SOON_TIMESPAN ): any[] {
        // To prevent errors if introducing a new content_type or vote type we check it inside the loop for each vote.
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
