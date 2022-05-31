import { Context, Markup, Telegraf } from 'telegraf';
import { Update } from 'typegram';
import { logger } from './logger';
import { ICONS } from "./constants";
import { Digest } from "./digest";


export class Interact {

    canPost = true;
    waitingForProposalPreviewNumber = false;

    mainMenuButtons = Markup.keyboard( [
            { text: ICONS.informal + ' Informal' },
            { text: ICONS.formal + ' Formal' },
            { text: ICONS.completed + ' Completed' },
            { text: ICONS.discussions + ' Discussions' },
            { text: ICONS.digest + ' Digest' },
            { text: ICONS.proposal + ' Proposal' },
            { text: ICONS.attention + ' Alerts' },
        ],
        {
            columns: 2,
        },
    );

    alertsButtons = Markup.keyboard( [
            { text: ICONS.informal + ' Updates' },
            { text: ICONS.formal + ' Test2' },
            { text: ICONS.home + ' Main Menu' },
        ],
        { columns: 2 }
    );

    constructor(
        protected bot: Telegraf<Context<Update>>,
        protected digest: Digest,
    ) {
        this.initHandlers().then( () => {
            logger.debug( 'Interactive bot part initialized.' )
        } );
    }

    async initHandlers(): Promise<void> {
        this.bot.start( ( ctx ) => {
            ctx.reply( `Hi ${ ctx.update.message.from.first_name }` );
            ctx.replyWithMarkdown(
                'Select an option:',
                this.mainMenuButtons,
            );
        } );

        this.bot.hears( ICONS.informal + ' Informal', async ( ctx ) => {
            await this.replyOnAction( ctx, async () => {
                const informal = await this.digest.informalVotes();
                let text = '__Active Informal__\n\n';
                for ( const vote of informal ) {
                    text += this.digest.voteToText( vote );
                }
                return text;
            } );
        } );

        this.bot.hears( ICONS.formal + ' Formal', async ( ctx ) => {
            await this.replyOnAction( ctx, async () => {
                const formal = await this.digest.formalVotes();
                let text = '__Active Formal__\n\n';
                for ( const vote of formal ) {
                    text += this.digest.voteToText( vote );
                }
                return text;
            } );
        } );

        this.bot.hears( ICONS.completed + ' Completed', async ( ctx ) => {
            await this.replyOnAction( ctx, async () => {
                let text = '__Recently Completed__\n\n';
                const completed = await this.digest.completedVotes();
                for ( const vote of completed ) {
                    text += this.digest.voteToText( vote, false, true );
                }
                return text;
            } );
        } );

        this.bot.hears( ICONS.digest + ' Digest', async ( ctx ) => {
            await this.replyOnAction( ctx, async () => {
                let text = '__Digest__\n\n';
                text += await this.digest.createDigest();
                return text;
            } );
        } );

        this.bot.hears( ICONS.discussions + ' Discussions', async ( ctx ) => {
            await this.replyOnAction( ctx, async () => {
                let text = '__Discussions with high attestation rate__\n\n';
                text += this.digest.discussionsText( await this.digest.discussions() );
                return text;
            } );
        } );

        this.bot.hears( ICONS.attention + ' Alerts', ( ctx ) => {
            ctx.replyWithMarkdown(
                'Select an option:',
                this.alertsButtons,
            );
        } );

        this.bot.hears( ICONS.proposal + ' Proposal', ( ctx ) => {
            ctx.reply( 'Enter the proposal number for the preview:' );
            this.waitingForProposalPreviewNumber = true;
        } );

        this.bot.hears( ICONS.home + ' Main Menu', ( ctx ) => {
            ctx.replyWithMarkdown(
                'Select an option:',
                this.mainMenuButtons,
            );
        } );

        this.bot.hears( ICONS.informal + ' Updates', ( ctx ) => {
            ctx.replyWithMarkdownV2(
                '__You are subscribed to the updates on the following proposals:__\n',
            );
        } );

        this.bot.on( 'text', async ( ctx ) => {
            let proposalId: number;
            if ( this.waitingForProposalPreviewNumber ) {
                this.reset();
                proposalId = parseInt( ctx.message.text );
                if ( !proposalId ) {
                    ctx.reply( 'Incorrect proposal number.' );
                    return;
                }
            } else {
                return;
            }

            const url = process.env.JSON_PROPOSAL_URL + proposalId;

            const result = await this.digest.apiClient.get( url ).catch(
                error => {
                    logger.warn( error.toString().substring( 0, 255 ) );
                    ctx.reply( 'Unable to find the specified proposal.' )
                }
            );

            if ( !result.success ) {
                ctx.reply( 'Unable to find the specified proposal.' )
                return;
            }

            console.log( result );

            await ctx.replyWithMarkdownV2(
                `__${ this.digest.escapeText( result.proposal.title ) }__\n\n` +
                `${ this.digest.escapeText( result.proposal.short_description ) }`
            )


        } );
    }

    async replyOnAction( ctx: any, method: any ): Promise<void> {
        this.reset();
        if ( !this.canPost ) return;
        this.canPost = false;
        const text = await method();
        await ctx.replyWithMarkdownV2( text );
        setTimeout( () => {
            this.canPost = true;
        }, 500 );
    }

    reset() {
        this.waitingForProposalPreviewNumber = false;
    }
}
