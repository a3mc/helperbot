import { ApiClient } from "./api-client";
import moment from "moment";

export class Digest {
    protected apiClient = new ApiClient();
    public icons = {
        dead: '☠️',
        ending: '⏳',
        interest: '📣',
        attention: '‼️',
        simple: '💚',
    }

    constructor() {
    }

    async createDigest(): Promise<any> {
        const informal = await this.informalVotes();
        const formal = await this.formalVotes();
        const discussions = await this.discussions();

        return [
            //this.simpleVotesText( informal, 'informal' ),
            //this.simpleVotesText( formal, 'formal' ),
            this.endingVotesText( informal, 'informal' ),
            this.endingVotesText( formal, 'formal' ),
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

    async informalVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.INFORMAL_SORTED_URL );
        return result.votes;
    }

    async formalVotes(): Promise<any> {
        const result = await this.apiClient.get( process.env.FORMAL_SORTED_URL );
        return result.votes;
    }

    async discussions(): Promise<any> {
        const result = await this.apiClient.get( process.env.DISCUSSIONS_URL );
        return result.proposals;
    }

    simpleVotesText( votes: any[], voteType: string ): string {
        let text = '';
        const simple = votes.filter( vote => vote.content_type === 'simple' );
        if ( simple.length ) {
            const multiple = simple.length > 1;
            text += this.icons.simple + ` __\*${ simple.length } ${ voteType } SIMPLE vote${ multiple ? 's' : '' }* ` +
                `require${ multiple ? '' : 's' } attention:__\n\n`;

            for ( const vote of simple ) {
                text += this.voteToText( vote );
            }
        }
        return text;
    }

    discussionsText( discussions: any[] ): string {
        let text = '';

        // These discussions should be removed as they are no longer active.
        const deadDiscussions = discussions.filter(
            discussion => moment( discussion.approved_at ).utc()
                .isBefore( moment().utc().add( -90, 'days' ) )
        );
        if ( deadDiscussions.length ) {
            const multiple = deadDiscussions.length > 1;
            text += this.icons.dead + ` __There ${ multiple ? 'are' : 'is' } \*${ deadDiscussions.length } ` +
                `discussion${ multiple ? 's' : '' }* older than 90 days__\\.\n\n`;
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
            text += this.icons.ending + ` __\*${ endingDiscussions.length } discussion${ multiple ? 's' : '' }* ` +
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
            text += this.icons.interest + ` __\*${ interestingDiscussions.length } discussion${ multiple ? 's' : '' }* ` +
                `may require more attention:__\n\n`;

            for ( const discussion of interestingDiscussions ) {
                text += this.discussionToText( discussion );
            }
        }
        return text;
    }

    endingVotesText( votes: any[], voteType: string ): string {
        let text = '';
        const ending = this.endingSoon( votes );
        if ( ending.length ) {
            const multiple = ending.length > 1;
            text += this.icons.attention + ` __\*${ ending.length } ${ voteType } vote${ multiple ? 's' : '' }* ` +
                `without a quorum end${ multiple ? '' : 's' } within ${ process.env.SOON_TIMESPAN }h:__\n\n`;

            for ( const vote of ending ) {
                text += this.voteToText( vote );
            }
        }
        return text;
    }

    voteToText( vote: any ): string {
        const title = '"' + this.escapeText( vote.title ) + '"';
        const contentType = this.escapeText( vote.content_type );
        const link = process.env.API_URL_PREFIX + process.env.PROPOSAL_URL + vote.proposalId;

        return `[\\#${ vote.proposalId }](${ link }) \_${ contentType }_: ${ title }\n` +
            `\\(\_${ vote.result_count }/${ vote.total_member || vote.total_user_va } voted_\\. ` +
            `\_Time left: ` + this.timeLeftToHM( vote.timeLeft ) + `_\\)\n\n`;
    }

    discussionToText( discussion: any, icon: string = '' ): string {
        const title = '"' + this.escapeText( discussion.title ) + '"';
        const contentType = this.escapeText( discussion.type );
        const link = process.env.API_URL_PREFIX + process.env.PROPOSAL_URL + discussion.id;
        const topicLink = process.env.TOPIC_URL + discussion.discourse_topic_id;
        const attestationRate = this.escapeText(
            String( Math.round( discussion.attestation.rate * 100 ) / 100 )
        );
        const approvedAt = this.escapeText( discussion.approved_at.substring( 0, 10 ) );

        return ( icon ? icon + ' ' : '' ) + `[\\#${ discussion.id }](${ link }) / ` +
            `[Topic ${ discussion.discourse_topic_id }](${ topicLink }) ` +
            `\_${ contentType }_: ${ title }\n` +
            `\\(\_Attestation rate:_ \*${ attestationRate }%* ` +
            `\_Approved at:_ ${ approvedAt }\\)\n\n`;
    }

    timeLeftToSeconds( timeLeft: string ): number {
        return Number( timeLeft.split( ':' ).join( '' ) );
    }

    timeLeftToHM( timeLeft: string ): string {
        return timeLeft.substring( 0, 5 ).replace( /:/, 'h ' ) + 'm';
    }

    endingSoon( votes: any[] ): any[] {
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
            return this.timeLeftToSeconds( vote.timeLeft ) < Number( process.env.SOON_TIMESPAN + '0000' ) &&
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
