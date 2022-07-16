import { Context, Markup, Telegraf } from 'telegraf';
import { Update } from 'typegram';
import { logger } from './logger';
import { ALERTS_BUTTONS, CONTEXTS, ERRORS, ICONS, MAIN_BUTTONS, MESSAGES, WEEKDAYS } from './constants';
import { Digest } from './digest';
import moment from 'moment';
import { DbClient } from './db-client';
import { checkTimeFormat, checkTimezoneFormat } from './validators';

export class Interact {

    cantPostChatIds: number[] = []; // Temporary paused users.
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

    async initHandlers(): Promise<void> {
        this.bot.start( async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            ctx.reply( `Hello ${ ctx.update.message.from.first_name }` );
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
            await this.showSettingsMenu( ctx );
        } );

        this.bot.hears( ICONS.proposal + ' Proposal #', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.reply( MESSAGES.proposal, Markup.forceReply() );
        } );

        this.bot.hears( ICONS.home + ' Main Menu', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await this.showMainMenu( ctx );
        } );

        // Set the Timezone UTC offset.
        this.bot.hears( ICONS.settings + ' Timezone', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            const timezone = ( await this.getUserPreferences( ctx.chat.id, 'general' ) ).timezone;
            await ctx.reply( 'Current timezone offset is ' + ( timezone > 0 ? '+' : '' ) + timezone );
            await ctx.reply( MESSAGES.timezone, Markup.forceReply() );
        } );

        // Set the Digest time.
        this.bot.hears( ICONS.simple + ' Time', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.reply( MESSAGES.digestTime, Markup.forceReply() );
        } );

        // Add a proposal to watch.
        this.bot.hears( 'Add #', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.reply( MESSAGES.add_proposal, Markup.forceReply() );
        } );

        // Remove proposal from the list.
        this.bot.hears( 'Remove #', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            await ctx.reply( MESSAGES.remove_proposal, Markup.forceReply() );
        } );

        // Listen for weekdays commands in the current context menu.
        for ( const day in WEEKDAYS ) {
            this.bot.hears( [ICONS.completed + ' ' + day, ICONS.off + ' ' + day], async ( ctx ) => {
                // Check user and the current context menu.
                if ( !await this.verifyUser( ctx ) ) return;
                const context = await this.dbClient.getMenu( ctx.chat.id );
                if ( !context.length || !CONTEXTS.includes( context[0].menu ) ) {
                    logger.warn( ERRORS.no_context, ctx.chat.id );
                    return await this.showMainMenu( ctx );
                }
                // Update user preferences with the inverted setting for day.
                const preferences = await this.getUserPreferences( ctx.chat.id, context[0].menu );
                await this.setUserPreferences( ctx, context[0].menu, {
                    pref: WEEKDAYS[day],
                    value: preferences !== [] ? !preferences[WEEKDAYS[day]] : false,
                } );
            } );
        }

        // Display a menu for each type of settings buttons, excluding back buttons.
        for ( const button of ALERTS_BUTTONS ) {
            if ( button.type ) {
                this.bot.hears( button.text, async ( ctx ) => {
                    if ( !await this.verifyUser( ctx ) ) return;
                    await this.dbClient.setMenu( ctx.chat.id, button.type );
                    if ( button.extraText ) {
                        await this.replyOnAction( ctx, () => {
                            return this.digest.escapeText( button.extraText );
                        } );
                    }
                    if ( button.type === 'proposals' ) {
                        const proposalsIds = await this.dbClient.getProposals( ctx.chat.id );
                        if ( !proposalsIds.length ) {
                            await ctx.reply( MESSAGES.no_proposals );
                        } else {
                            let text: string[] = [];
                            for ( const proposal of proposalsIds ) {
                                const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + proposal;
                                text.push( `[${ proposal }](${ link })` );
                            }
                            await ctx.replyWithMarkdownV2(
                                this.digest.escapeText( MESSAGES.proposals_ids ) + text.join( ', ' )
                            );
                        }
                    }
                    await this.showMenu( ctx );
                } );
            }
        }

        this.bot.on( 'text', async ( ctx ) => {
            if ( !await this.verifyUser( ctx ) ) return;
            // Check if it's a user reply on a request.
            if ( ctx.message.reply_to_message ) {
                return await this.processReplies( ctx );
            }
            // Just open a menu of unrecognised text input.
            await this.showMenu( ctx );
        } );
    }

    async processReplies( ctx: any ): Promise<void> {
        const context = await this.dbClient.getMenu( ctx.chat.id );
        if ( !context.length ) {
            logger.warn( ERRORS.no_context, ctx.chat.id );
            return await this.showMainMenu( ctx );
        }

        // Setting Digest post time
        if (
            ctx.message.reply_to_message.text === MESSAGES.digestTime &&
            context[0].menu === 'digest'
        ) {
            if ( !checkTimeFormat( ctx.message.text ) ) {
                await ctx.reply( ERRORS.time_format );
                return await this.showMenu( ctx );
            }
            // Save time in db.
            return await this.setUserPreferences( ctx, 'digest', {
                pref: 'post_time',
                value: ctx.message.text
            } );
        } else if (
            ctx.message.reply_to_message.text === MESSAGES.timezone &&
            context[0].menu === 'settings'
        ) {
            // Setting local timezone offset
            const offset = parseInt( ctx.message.text );
            if ( checkTimezoneFormat( offset ) ) {
                await ctx.reply( ERRORS.timezone );
                return await this.showMenu( ctx );
            }
            // Save timezone UTC offset in db.
            return await this.setUserPreferences( ctx, 'general', {
                pref: 'timezone',
                value: offset,
            } )
        } else if (
            ctx.message.reply_to_message.text === MESSAGES.proposal &&
            context[0].menu === 'main'
        ) {
            const proposalId = parseInt( ctx.message.text );
            if ( isNaN( proposalId ) || proposalId < 0 ) {
                await ctx.reply( ERRORS.incorrect_proposal );
                return await this.showMenu( ctx );
            }

            const url = process.env.JSON_PROPOSAL_URL + proposalId;
            const result = await this.digest.apiClient.get( url ).catch(
                async error => {
                    logger.warn( error.toString().substring( 0, 255 ) );
                }
            );

            if ( !result.success ) {
                await ctx.reply( ERRORS.not_found_proposal );
                return await this.showMenu( ctx );
            }

            const link = process.env.PORTAL_URL_PREFIX + process.env.PROPOSAL_URL + proposalId;
            await ctx.replyWithMarkdownV2(
                `[\\#${ proposalId } ` +
                `__${ this.digest.escapeText( result.proposal.title ) }__](${ link })\n\n` +
                `${ this.digest.escapeText( result.proposal.short_description.substring( 0, 1024 ) + '...' ) }`
            );
            return await this.showMenu( ctx );
        } else if (
            ctx.message.reply_to_message.text === MESSAGES.add_proposal &&
            context[0].menu === 'proposals'
        ) {
            const proposalId = parseInt( ctx.message.text );
            if ( isNaN( proposalId ) || proposalId < 0 ) {
                await ctx.reply( ERRORS.incorrect_proposal );
                return await this.showMenu( ctx );
            }
            const proposalIds = await this.dbClient.getProposals( ctx.chat.id );
            if ( proposalIds.includes( proposalId ) ) {
                await ctx.reply( ERRORS.existing_proposal );
                return await this.showMenu( ctx );
            }

            await this.dbClient.saveProposal( ctx.chat.id, proposalId );
            return await this.showMenu( ctx );
        } else if (
            ctx.message.reply_to_message.text === MESSAGES.remove_proposal &&
            context[0].menu === 'proposals'
        ) {
            const proposalId = parseInt( ctx.message.text );
            if ( isNaN( proposalId ) || proposalId < 0 ) {
                await ctx.reply( ERRORS.incorrect_proposal );
                return await this.showMenu( ctx );
            }
            await this.dbClient.removeProposal( ctx.chat.id, proposalId );
            return await this.showMenu( ctx );
        }
    }

    // Try to get saved user preferences for a given type from db.
    async getUserPreferences( chatId: number, type: string ): Promise<any> {
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
                post_time: '15:00',
                timezone: 0,
            };
        } else {
            return preferences[0];
        }
    }

    // Save the new menu and display it in the menu.
    async setUserPreferences( ctx: any, type: string, preference: any ): Promise<void> {
        // Save and redraw the menu with the new value.
        await this.dbClient.setPreferences( ctx.chat.id, type, preference );
        await this.showMenu( ctx );
    }

    // Based on the current menu context it decides which menu to display.
    async showMenu( ctx: any ): Promise<void> {
        const context = await this.dbClient.getMenu( ctx.chat.id );
        if ( context.length ) {
            if ( CONTEXTS.includes( context[0].menu ) ) {
                return await this.showCalendarMenu( ctx, context[0].menu );
            } else if ( context[0].menu === 'settings' ) {
                return await this.showSettingsMenu( ctx );
            }
        }
        await this.showMainMenu( ctx );
    }

    // Default home menu with instant actions.
    async showMainMenu( ctx: any ): Promise<void> {
        await this.dbClient.setMenu( ctx.chat.id, 'main' );
        await ctx.replyWithMarkdown( MESSAGES.main_menu, this.mainMenuButtons );
    }

    // Settings menu.
    async showSettingsMenu( ctx: any ): Promise<void> {
        await this.dbClient.setMenu( ctx.chat.id, 'settings' );
        await ctx.replyWithMarkdown( MESSAGES.settings_menu, this.alertsMenuButtons );
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

        // Only Digest has a Time setting. Other notifications are delivered immediately on selected weekdays.
        if ( type === 'digest' ) {
            calendarButtons.push( { text: ICONS.simple + ' Time' } );
        }

        if ( type === 'proposals' ) {
            calendarButtons.push(
                { text: 'Add #' },
                { text: 'Remove #' },
            );
        }

        calendarButtons.push(
            { text: ICONS.settings + ' Settings' },
            { text: ICONS.home + ' Main Menu' }
        );

        const calendarMenuButtons = Markup.keyboard( calendarButtons, { columns: 7 } );
        await ctx.replyWithMarkdown(
            MESSAGES.calendar_menu + ' ' + type.toUpperCase() + ':',
            calendarMenuButtons,
        );
    }

    // Launch an immediate action when called from the main menu.
    async replyOnAction( ctx: any, method: Function ): Promise<void> {
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

        // Ignore old messages in case of bot reload or network errors occurred.
        if ( moment.unix( ctx.message.date ).utc().diff( moment().utc(), 'seconds' ) < -60 ) {
            logger.warn( 'Message older than 60 seconds detected, ignoring.' );
            return false;
        }
        return true;
    }
}
