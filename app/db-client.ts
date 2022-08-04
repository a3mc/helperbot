import moment from 'moment';
import { logger } from './logger';
import mysql from 'mysql';
import util from 'util';
import { POST_TYPES, WEEKDAYS, WEEKDAYS_ARRAY } from './constants';

// Helper class for database queries and related manipulations with data.
export class DbClient {
    // Create the connection pool with the credentials defined in .env
    protected pool = mysql.createPool( {
        connectionLimit: 10,
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
    } );
    protected query = util.promisify( this.pool.query ).bind( this.pool );

    // This method is used to save information about the made post.
    // For individual posts it also saves the proposal ids to prevent double posting.
    async post( type: number, result: number, proposalId = 0, voteType = 0, chatId = 0 ): Promise<void> {
        const query = 'INSERT INTO posts (type, date, result, proposal_id, vote_type, chat_id) VALUES (?, ?, ?, ?, ?, ?)';
        await this.query(
            query,
            [type, moment().utc().format( 'YYYY-MM-DD HH:mm:ss' ), result, proposalId, voteType, chatId]
        )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error when inserting a record.' );
                throw new Error();
            } );
    }

    // Check if the last Digest post was made already within a certain interval.
    async checkLastPost( type: number, chatId = 0 ): Promise<boolean> {
        let date = moment().utc().add( -Number( process.env.POST_RETRY_TIME ), 'minutes' )
                .format( 'YYYY-MM-DD HH:mm:ss' );

        const query = 'SELECT id FROM posts WHERE type=? AND result=? AND chat_id=? AND DATE>?';
        const result = await this.query( query, [type, 1, chatId, date] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error when checking for records.' );
                throw new Error();
            } );

        return !!result.length;
    }

    // Similar to checkLastPost but designed to check for individual posts about new/completed proposals.
    async checkPost(
        proposalId: number,
        voteType: number,
        postType = POST_TYPES.new_simple,
        chatId = 0,
    ): Promise<boolean> {
        const query = 'SELECT id FROM posts WHERE type=? AND result=? AND proposal_id=? AND vote_type=? AND chat_id=?';
        const result = await this.query( query, [postType, 1, proposalId, voteType, chatId] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error when checking for records.' );
                throw new Error();
            } );

        return !!result.length;
    }

    // Check if there was already an extra alret about the failed proposal.
    async checkFailedPost( proposalId: number, chatId = 0 ): Promise<boolean> {
        const query = 'SELECT id FROM posts WHERE type=? AND result=? AND proposal_id=? AND chat_id=?';
        const result = await this.query( query, [POST_TYPES.failed_no_quorum, 1, proposalId, chatId] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error when checking for records.' );
                throw new Error();
            } );

        return !!result.length;
    }

    // Get current user's menu type by chat id.
    async getMenu( chatId: number ): Promise<any> {
        const query = 'SELECT menu FROM context WHERE chat_id=?';
        const result = await this.query( query, [chatId] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error getting user\'s menu.' );
                throw new Error();
            } );

        return result;
    }

    // Set current user's menu type by chat id.
    async setMenu( chatId: number, menu: string ): Promise<any> {
        let query = 'SELECT menu FROM context WHERE chat_id=?';
        let result = await this.query( query, [chatId] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error getting user\'s menu.' );
                throw new Error();
            } );

        query = 'UPDATE context SET menu=? WHERE chat_id=?';
        if ( !result.length ) {
            query = 'INSERT INTO context (menu, chat_id) VALUES (?, ? )'
        }

        result = await this.query( query, [
            menu,
            chatId
        ] );

        return result;
    }

    // Get proposal ids that user put to the watch list.
    async getProposals( chatId: number ): Promise<any> {
        const query = 'SELECT proposal_id FROM proposals WHERE chat_id=?';
        const result = await this.query( query, [chatId] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error getting user\'s proposals.' );
                throw new Error();
            } );

        return result.map( item => item.proposal_id );
    }

    // Save proposal id to the user's watch list.
    async saveProposal( chatId: number, proposalId: number ): Promise<any> {
        const query = 'INSERT INTO proposals (chat_id, proposal_id) VALUES(?, ?)';
        const result = await this.query( query, [chatId, proposalId] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error saving user\'s proposal.' );
                throw new Error();
            } );

        return result;
    }

    // Remove proposal id from the user's watch list.
    async removeProposal( chatId: number, proposalId: number ): Promise<any> {
        const query = 'DELETE from proposals WHERE chat_id=? AND proposal_id=?';
        const result = await this.query( query, [chatId, proposalId] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error removing user\'s proposal.' );
                throw new Error();
            } );

        return result;
    }

    // Get stored user preferences by Chat ID and type.
    async getPreferences( chatId: number, type: string ): Promise<any> {
        const query = 'SELECT * FROM preferences WHERE chat_id=? AND pref_type=?';
        const result = await this.query( query, [chatId, type] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error getting preferences.' );
                throw new Error();
            } );

        return result;
    }

    // Store user preferences by Chat ID and type.
    async setPreferences( chatId: number, type: string, preference: any ): Promise<any> {
        const existingPreferences = await this.getPreferences( chatId, type );
        let query = 'UPDATE preferences SET ' + preference.pref + '=? WHERE chat_id=? AND pref_type=?';
        if ( !existingPreferences.length ) {
            query = 'INSERT INTO preferences (' + preference.pref + ', chat_id, pref_type) VALUES (? ,?, ?)';
        }

        const result = await this.query( query, [
            preference.value,
            chatId,
            type
        ] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error setting preferences.' );
                throw new Error();
            } );

        return result;
    }

    // Find chat ids that match "today" according to their Timezone offset setting. It's 0 (UTC) by default.
    async todayChatIds(): Promise<any[]> {
        let query = 'SELECT chat_id, timezone from preferences WHERE pref_type="general"';
        let result = await this.query( query )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error getting timezone offsets.' );
                throw new Error();
            } );

        return result.map( item => {
            return {
                chat_id: item.chat_id,
                timezone: item.timezone
            }
        } );
    }

    // Get collection of chat ids that can be notified now for the given prefType.
    async subscribedChats( prefType: string ): Promise<number[]> {
        // Find users who have custom timezone saved in preferences.
        const usersWithTimezone = await this.todayChatIds();

        // Find all custom settings for the given preference type (prefType).
        let query = 'SELECT * from preferences WHERE pref_type=?';
        let result = await this.query( query, [prefType] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error getting users with matching prefType.' );
                throw new Error();
            } );

        // Nobody is subscribed to custom notifications of a given prefType yet.
        if ( !result.length ) {
            return [];
        }

        // Collect chat ids that require to get a posted.
        const chatIds = [];
        for ( const chat of result ) {
            const userWithTimezone = usersWithTimezone.find(
                item => item.chat_id === chat.chat_id
            );
            // Use either custom user's timezone offset or default (UTC).
            const timezoneOffset = userWithTimezone ? userWithTimezone.timezone : 0;
            // Determine the current weekday for the user with regard to the timezone offset.
            const today = WEEKDAYS_ARRAY[moment().utc().add( timezoneOffset, 'hours' ).weekday()];

            // If user has a setting to have a post for today.
            if ( chat[today] ) {
                // Check if the post was already made.
                // That happens to cover the scenario if system was down for some time, and to prevent double post.
                let postedAlready = false;
                // Check time settings and if post made for Digest. For other types return the full list of subscribers.
                if ( prefType === 'digest' ) {
                    const postTimeSetting = chat.post_time.split( ':' );
                    const postTime = moment().utcOffset( timezoneOffset )
                        .hours( postTimeSetting[0] )
                        .minutes( postTimeSetting[1] )
                        .seconds( 0 );

                    // If the now-time is in range of the scheduled time and defined window.
                    if (
                        moment().utcOffset( timezoneOffset ).isSameOrAfter( postTime ) &&
                        moment().utcOffset( timezoneOffset ).isBefore(
                            postTime.clone().add( process.env.POST_RETRY_TIME, 'minutes' )
                        )
                    ) {
                        postedAlready = await this.checkLastPost( POST_TYPES[prefType], chat.chat_id );
                    } else {
                        postedAlready = true;
                    }
                }

                // Unless it doesnt pass the digest check, add it to the array.
                if ( !postedAlready ) {
                    // Add chat id to the array - this user has to receive a post now.
                    chatIds.push( chat.chat_id );
                }
            }
        }
        return chatIds;
    }

    // That's used by a migration to script to create or alter database for future updates.
    async migrate( query: string ): Promise<void> {
        const result = await this.query( query )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error executing migration script.' );
                throw new Error();
            } );
    }
}
