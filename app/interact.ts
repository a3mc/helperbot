import { Context, Markup, Telegraf } from 'telegraf';
import { Update } from 'typegram';
import { logger } from './logger';
import { ICONS } from "./constants";
import { Digest } from "./digest";
import moment from "moment";


export class Interact {

    cantPostChatIds: number[] = [];
    waitingForProposalPreviewNumberChatIds: number[] = [];
    verifiedUsers: number[] = [];
    rateLimit = 400; // User can post not more often then this amount of time in ms.

    mainButtons = [
        { text: ICONS.informal + ' Informal' },
        { text: ICONS.formal + ' Formal' },
        { text: ICONS.completed + ' Completed' },
        { text: ICONS.discussions + ' Discussions' },
        { text: ICONS.digest + ' Digest' },
        { text: ICONS.proposal + ' Proposal #' },
        { text: ICONS.alert + ' My Alerts' },
    ]

    mainMenuButtons = Markup.keyboard(
        this.mainButtons,
        { columns: 2 },
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

    async verifyUser( ctx ): Promise<boolean> {
        const userId = ( await ctx.getChat() ).id;

        // Check if this user is already verified.
        if ( this.verifiedUsers.includes( userId ) ) {
            return true;
        }

        // Check if user is a member of the common Bot channel.
        const channelUser = await ctx.telegram.getChatMember( Number( process.env.CHAT_ID ), userId );
        if ( userId !== channelUser.user.id ) {
            await ctx.replyWithMarkdown(
                `Sorry, you don\'t have access to this bot. Please make sure you are a member ` +
                `of the DxD VAs group Helper Bot channel` );
            return false;
        }

        // Add users to the temporary array, so we can avoid double checks until the next app relaunch.
        if ( !this.verifiedUsers.includes( userId ) ) {
            this.verifiedUsers.push( userId );
        }

        // Ignore old messages in case of bot reload happened.
        if ( moment.unix( ctx.message.date ).utc().diff( moment().utc(), 'seconds' ) < -60 ) {
            logger.warn( 'Message older than 60 seconds detected, ignoring.' );
            return false;
        }
        return true;
    }

    async initHandlers(): Promise<void> {
        this.bot.start( async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            ctx.reply( `Hi ${ ctx.update.message.from.first_name }` );
            await this.showMainMenu( ctx );
        } );

        this.bot.hears( ICONS.informal + ' Informal', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
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
            if ( !await this.verifyUser( ctx ) ) return;
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
            if ( !await this.verifyUser( ctx ) ) return;
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
            if ( !await this.verifyUser( ctx ) ) return;
            await this.replyOnAction( ctx, async () => {
                let text = '__Digest__\n\n';
                text += await this.digest.createDigest();
                return text;
            } );
        } );

        this.bot.hears( ICONS.discussions + ' Discussions', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await this.replyOnAction( ctx, async () => {
                let text = '__Discussions with high attestation rate__\n\n';
                text += this.digest.discussionsText( await this.digest.discussions() );
                return text;
            } );
        } );

        this.bot.hears( ICONS.alert + ' My Alerts', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.replyWithMarkdown(
                'Select an option:',
                this.alertsButtons,
            );
        } );

        this.bot.hears( ICONS.proposal + ' Proposal #', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.reply( 'Enter the proposal number for the preview:' );
            this.reset( ctx );
            this.waitingForProposalPreviewNumberChatIds.push( ctx.chat.id );
        } );

        this.bot.hears( ICONS.home + ' Main Menu', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.replyWithMarkdown(
                'Select an option:',
                this.mainMenuButtons,
            );
        } );

        this.bot.hears( ICONS.informal + ' Updates', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.replyWithMarkdownV2(
                '__You are subscribed to the updates on the following proposals:__\n',
            );
        } );

        this.bot.on( 'text', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;

            // Check if it's an unknown command and redraw the menu.
            let unknownMessage = true;
            for ( const command of this.mainButtons ) {
                if ( command.text === ctx.message.text ) {
                    unknownMessage = false;
                }
            }

            let proposalId: number;
            if ( this.waitingForProposalPreviewNumberChatIds.includes( ctx.chat.id ) ) {
                this.reset( ctx );
                proposalId = parseInt( ctx.message.text );
                if ( !proposalId ) {
                    ctx.reply( 'Incorrect proposal number.' );
                    await this.showMenu( ctx );
                    return;
                }
            } else {
                if ( unknownMessage ) {
                    await this.showMenu( ctx );
                }
                return;
            }

            const url = process.env.JSON_PROPOSAL_URL + proposalId;

            const result = await this.digest.apiClient.get( url ).catch(
                async error => {
                    logger.warn( error.toString().substring( 0, 255 ) );
                    ctx.reply( 'Unable to find the specified proposal.' );
                    await this.showMenu( ctx );
                }
            );

            if ( !result.success ) {
                ctx.reply( 'Unable to find the specified proposal.' );
                await this.showMenu( ctx );
                return;
            }

            const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + proposalId;

            await ctx.replyWithMarkdownV2(
                `[\\#${ proposalId } ` +
                `__${ this.digest.escapeText( result.proposal.title ) }__](${ link })\n\n` +
                `${ this.digest.escapeText( result.proposal.short_description.substring( 0, 2048 ) + '...' ) }`
            );
            await this.showMenu( ctx );
        } );
    }

    async showMenu( ctx: any ): Promise<void> {
        await this.showMainMenu( ctx );
    }

    async showMainMenu( ctx: any ): Promise<void> {
        await ctx.replyWithMarkdown(
            'Select an option:',
            this.mainMenuButtons,
        );
    }

    async replyOnAction( ctx: any, method: any ): Promise<void> {
        this.reset( ctx );

        // Prevent too often posts by temporary saving the chat id.
        if ( this.cantPostChatIds.includes( ctx.chat.id ) ) {
            return;
        }
        this.cantPostChatIds.push( ctx.chat.id );

        const text = await method();
        await ctx.replyWithMarkdownV2( text );

        // Allow user to post again. Remove it from the list.
        setTimeout( () => {
            const index = this.cantPostChatIds.indexOf( ctx.chat.id );
            if ( index !== -1 ) {
                this.cantPostChatIds.splice( index, 1 );
            }
        }, this.rateLimit );
    }

    reset( ctx: any ) {
        // Remove user from the list who's waiting to post the proposal id.
        const index = this.waitingForProposalPreviewNumberChatIds.indexOf( ctx.chat.id );
        if ( index !== -1 ) {
            this.waitingForProposalPreviewNumberChatIds.splice( index, 1 );
        }
    }
}
