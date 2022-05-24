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

        return [
            this.endingVotesText( this.endingSoon( informal ), 'informal' ),
            this.endingVotesText( this.endingSoon( formal ), 'formal' ),
            this.discussionsText( discussions ),
        ].join( '' );
    }

    async listSimple(): Promise<any> {
        const informal = await this.informalVotes();
        const formal = await this.formalVotes();

        return [
            this.simpleVotesText( informal, 'informal' ),
            this.simpleVotesText( formal, 'formal' ),
        ].join( '' );
    }

    async newSimple(): Promise<any> {
        const informal = ( await this.informalVotes() ).filter( vote => vote.content_type === 'simple' );
        const formal = ( await this.formalVotes() ).filter( vote => vote.content_type === 'simple' );
        let newInformal = [];
        let newFormal = [];

        // Check if posts for the votes were already made.
        for ( const vote of informal ) {
            if ( !await this.dbClient.checkSimplePost( vote.id, VOTE_TYPES.informal ) ) {
                newInformal.push( vote );
            }
        }
        for ( const vote of formal ) {
            if ( !await this.dbClient.checkSimplePost( vote.id, VOTE_TYPES.formal ) ) {
                newFormal.push( vote );
            }
        }

        return {
            informalIds: newInformal.map( vote => vote.id ),
            formalIds: newFormal.map( vote => vote.id ),
            text: [
                this.simpleVotesText( newInformal, 'informal', true ),
                this.simpleVotesText( newFormal, 'formal', true ),
            ].join( '' )
        }
    }

    async expiringSimpleNoQuorum(): Promise<any> {
        const informal = this.endingSoon( ( await this.informalVotes() ).filter(
            vote => vote.content_type === 'simple'
        ), process.env.SIMPLE_NO_QUORUM_ALERT );
        const formal = this.endingSoon( ( await this.formalVotes() ).filter(
            vote => vote.content_type === 'simple'
        ), process.env.SIMPLE_NO_QUORUM_ALERT );

        let newInformal = [];
        let newFormal = [];

        // Check if posts for the votes were already made.
        for ( const vote of informal ) {
            if ( !await this.dbClient.checkSimplePost( vote.id, VOTE_TYPES.informal, POST_TYPES.expiring_simple ) ) {
                newInformal.push( vote );
            }
        }
        for ( const vote of formal ) {
            if ( !await this.dbClient.checkSimplePost( vote.id, VOTE_TYPES.formal, POST_TYPES.expiring_simple ) ) {
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

    simpleVotesText( votes: any[], voteType: string, newVote = false ): string {
        let text = '';
        const simple = votes.filter( vote => vote.content_type === 'simple' );
        if ( simple.length ) {
            const multiple = simple.length > 1;
            if ( newVote ) {
                text += ICONS.new_simple + ` __\*${ simple.length } new SIMPLE* ` +
                    `just entered \_${ voteType }_:__\n\n`;
            } else {
                text += ICONS.simple + ` __\*${ simple.length } ${ voteType } SIMPLE* ` +
                    `require${ multiple ? '' : 's' } attention:__\n\n`;
            }
            for ( const vote of simple ) {
                text += this.voteToText( vote );
            }
        }
        return text;
    }

    failedNoQuorumText( votes: any[] ): string {
        let text = '';
        if ( votes.length ) {
            text += ICONS.no_quorum + ` __\*${ votes.length } failed without no quorum:*__\n\n`;
            for ( const vote of votes ) {
                text += this.voteToText( vote, false );
            }
        }
        return text;
    }

    discussionsText( discussions: any[] ): string {
        let text = '';

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

        // These discussions have high attestation rate and may require attention.
        const interestingDiscussions = discussions.filter(
            discussion =>
                moment( discussion.approved_at ).utc().isAfter( moment().utc().add( -90, 'days' ) ) &&
                Number( discussion.attestation.rate ) >= Number( process.env.ATTESTATION_INTEREST )
        );
        if ( interestingDiscussions.length ) {
            const multiple = interestingDiscussions.length > 1;
            text += ICONS.interest + ` __\*${ interestingDiscussions.length } ` +
                `discussion${ multiple ? 's' : '' }* require attention:__\n\n`;

            for ( const discussion of interestingDiscussions ) {
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
            text += ICONS.attention + ` __\*${ ending.length } ${ voteType }* \\- no quorum:__\n\n`;
            for ( const vote of ending ) {
                text += this.voteToText( vote );
            }
        }
        return text;
    }

    voteToText( vote: any, full = true ): string {
        const title = '"' + this.escapeText( vote.title ) + '"';
        const contentType = this.escapeText( vote.content_type );
        const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + vote.proposalId;

        return `[\\#${ vote.proposalId }](${ link }) \_${ contentType }_: ${ title }` +
            ( full ? (
                `\n\\(\_${ vote.result_count }/${ vote.total_member || vote.total_user_va } voted_\\. ` +
                `\_Time left: ` + this.timeLeftToHM( vote.timeLeft ) + `_\\)`
            ) : '' ) + '\n\n';
    }

    discussionToText( discussion: any, icon: string = '' ): string {
        const title = '"' + this.escapeText( discussion.title ) + '"';
        const contentType = this.escapeText( discussion.type );
        const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + discussion.id;
        const attestationRate = this.escapeText(
            String( Math.round( discussion.attestation.rate * 100 ) / 100 )
        );
        const approvedAt = this.escapeText( discussion.approved_at.substring( 0, 10 ) );

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
            } else if ( vote.content_type === 'grant' ) {
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
