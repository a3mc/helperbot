import { Context, Markup, Telegraf } from 'telegraf';
import { Update } from 'typegram';
import { logger } from './logger';
import { ALERTS_BUTTONS, CONTEXTS, ICONS, MAIN_BUTTONS, WEEKDAYS } from './constants';
import { Digest } from './digest';
import moment from 'moment';
import { DbClient } from './db-client';


export class Interact {

    cantPostChatIds: number[] = []; // Temporary paused users.
    waitingForProposalPreviewNumberChatIds: number[] = []; // Chat ids that are waiting for proposal #.
    verifiedUsers: number[] = []; // Remember if user is a member of main chat, so we don't check it each time.
    actionDelayTime = 400; // User can trigger immediate action not more often than this amount of time in ms.
    mainMenuButtons = Markup.keyboard( MAIN_BUTTONS, { columns: 2 } );
    alertsMenuButtons = Markup.keyboard( ALERTS_BUTTONS, { columns: 2 } );

    constructor(
        protected bot: Telegraf<Context<Update>>,
        protected digest: Digest,
        protected dbClient: DbClient,
    ) {
        this.initHandlers().then( () => {
            logger.debug( 'Interactive bot part initialized.' )
        } );
    }

    // Check if user can use this bot.
    async verifyUser( ctx ): Promise<boolean> {
        const userId = ( await ctx.getChat() ).id;

        // Check if this user is already verified.
        if ( this.verifiedUsers.includes( userId ) ) {
            return true;
        }

        // Check if user is a member of the common Bot channel.
        const channelUser = await ctx.telegram.getChatMember( Number( process.env.CHAT_ID ), userId );
        if ( !channelUser || userId !== channelUser.user.id ) {
            await ctx.replyWithMarkdown(
                `Sorry, you don\'t have access to this bot. Please make sure you are a member ` +
                `of the DxD VAs Helper Bot channel.` );
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

        this.bot.hears( ICONS.settings + ' Settings', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.replyWithMarkdown(
                'Select an option:',
                this.alertsMenuButtons,
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

        // Set the Digest time.
        this.bot.hears( ICONS.simple + ' Time', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;

            await ctx.replyWithMarkdownV2(
                '__You are subscribed to the updates on the following proposals:__\n',
            );
        } );

        // Listen for weekdays commands in the current context menu.
        for ( const day in WEEKDAYS ) {
            this.bot.hears( [ICONS.completed + ' ' + day, ICONS.off + ' ' + day], async ( ctx ) => {
                // Check user and the current context menu.
                if ( !await this.verifyUser( ctx ) ) return;
                const context = await this.dbClient.getMenu( ctx.chat.id );
                if ( !context.length || !CONTEXTS.includes( context[0].menu ) ) {
                    logger.warn( 'No context found for %d', ctx.chat.id );
                    await this.showMainMenu( ctx );
                    return;
                }

                // Update user preferences with the inverted setting for day.
                const preferences = await this.getUserPreferences( ctx.chat.id, context[0].menu );
                await this.setUserPreferences( ctx, context[0].menu, {
                    weekday: WEEKDAYS[day],
                    value: preferences !== [] ? !preferences[WEEKDAYS[day]] : false,
                } );
            } );
        }

        // Display a menu for each type of settings buttons, excluding back buttons.
        for ( const button of ALERTS_BUTTONS ) {
            if ( button.type ) {
                this.bot.hears( button.text , async ( ctx ) => {
                    if ( !await this.verifyUser( ctx ) ) return;
                    await this.dbClient.setMenu( ctx.chat.id, button.type );
                    await this.replyOnAction( ctx, async () => {
                        let text = this.digest.escapeText( button.extraText );
                        return text;
                    } );
                    await this.showCalendarMenu( ctx, button.type );
                } );
            }
        }

        this.bot.on( 'text', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;

            // Check if it's an unknown command and redraw the menu if needed.
            let unknownMessage = true;
            for ( const command of MAIN_BUTTONS ) {
                if ( command.text === ctx.message.text ) {
                    unknownMessage = false;
                }
            }
            for ( const command of ALERTS_BUTTONS ) {
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

    async getUserPreferences( chatId: number, type = 'digest' ): Promise<any> {
        const preferences = await this.dbClient.getPreferences( chatId, type );
        // Return default if not found.
        if ( !preferences.length ) {
            return {
                sunday: false,
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: false,
                saturday: false,
                time: '15:00',
            };
        } else {
            return preferences[0];
        }
    }

    // Save the new menu and display it in the menu.
    async setUserPreferences( ctx: any, type = 'digest', preference: any ): Promise<void> {
        // Save and redraw the menu with the new value.
        await this.dbClient.setPreferences( ctx.chat.id, type, preference );
        await this.showCalendarMenu( ctx, type );
    }

    // Display a calendar menu for the settings sub-pages. Type defines the menu context.
    async showCalendarMenu( ctx: any, type: string ): Promise<void> {
        const userPreferences = await this.getUserPreferences( ctx.chat.id, type );

        // Prepare a set of calendar buttons for the menu.
        const calendarButtons = [
            { text: ( userPreferences.sunday ? ICONS.completed : ICONS.off ) + ' SU' },
            { text: ( userPreferences.monday ? ICONS.completed : ICONS.off ) + ' MO' },
            { text: ( userPreferences.tuesday ? ICONS.completed : ICONS.off ) + ' TU' },
            { text: ( userPreferences.wednesday ? ICONS.completed : ICONS.off ) + ' WE' },
            { text: ( userPreferences.thursday ? ICONS.completed : ICONS.off ) + ' TH' },
            { text: ( userPreferences.friday ? ICONS.completed : ICONS.off ) + ' FR' },
            { text: ( userPreferences.saturday ? ICONS.completed : ICONS.off ) + ' SA' },
        ];

        // Only Digest has a Time setting. Other notifications are delivered immediately.
        if ( type === 'digest' ) {
            calendarButtons.push( { text: ICONS.simple + ' Time' } );
        }
        calendarButtons.push(
            { text: ICONS.settings + ' Settings' },
            { text: ICONS.home + ' Main Menu' }
        );

        const calendarMenuButtons = Markup.keyboard( calendarButtons, { columns: 7 } );

        // FIXME: editMessageReplyMarkup
        const message = await ctx.replyWithMarkdown(
            'Set schedule:',
            calendarMenuButtons,
        );
    }

    // Launch an immediate action when called from the main menu.
    async replyOnAction( ctx: any, method: Function ): Promise<void> {
        this.reset( ctx );

        // Prevent too often actions by temporary saving the chat id.
        if ( this.cantPostChatIds.includes( ctx.chat.id ) ) {
            return;
        }
        this.cantPostChatIds.push( ctx.chat.id );

        const text = await method();
        await ctx.replyWithMarkdownV2( text );

        // Allow user to launch an immediate action again. Remove it from the list.
        setTimeout( () => {
            const index = this.cantPostChatIds.indexOf( ctx.chat.id );
            if ( index !== -1 ) {
                this.cantPostChatIds.splice( index, 1 );
            }
        }, this.actionDelayTime );
    }

    reset( ctx: any ) {
        // Remove user from the list who's waiting to post the proposal id.
        const index = this.waitingForProposalPreviewNumberChatIds.indexOf( ctx.chat.id );
        if ( index !== -1 ) {
            this.waitingForProposalPreviewNumberChatIds.splice( index, 1 );
        }
    }
}
