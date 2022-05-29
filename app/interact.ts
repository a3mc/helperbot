import { Context, Markup, Telegraf } from 'telegraf';
import { Update } from 'typegram';
import { logger } from './logger';
import { ICONS } from "./constants";
import { Digest } from "./digest";


export class Interact {

    protected canPost = true;

    constructor(
        protected bot: Telegraf<Context<Update>>,
        protected digest: Digest,
        ) {
        this.initHandlers().then( () => {
            logger.debug( 'Interactive bot part initialized.' )
        } );
    }

    async initHandlers(): Promise<void> {
        this.bot.start(( ctx ) => {
            ctx.reply( `Hi ${ ctx.update.message.from.first_name }` );
            const buttons = Markup.keyboard( [
                    { text: ICONS.informal + ' Informal' },
                    { text: ICONS.formal + ' Formal' },
                    { text: ICONS.completed + ' Completed' },
                    { text: ICONS.discussions + ' Discussions' },
                    { text: ICONS.digest + ' Digest' },
                    { text: ICONS.attention + ' Alerts' },
                ],
                { columns: 2 }
            );

            ctx.replyWithMarkdown(
                'Select an option:',
                buttons,
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
    }

    async replyOnAction( ctx: any, method: any ): Promise<void> {
        if ( !this.canPost ) return;
        this.canPost = false;
        const text = await method();
        await ctx.replyWithMarkdownV2( text );
        setTimeout( () => { this.canPost = true; }, 500 );
    }
}
