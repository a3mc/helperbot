import moment from 'moment';
import { logger } from './logger';
import mysql from 'mysql';
import util from 'util';
import { POST_TYPES } from './constants';

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
    async post( type: number, result: number, proposalId = 0, voteType = 0 ): Promise<void> {
        const query = 'INSERT INTO posts (type, date, result, proposal_id, vote_type) VALUES (?, ?, ?, ?, ?)';
        await this.query(
            query,
            [type, moment().utc().format( 'YYYY-MM-DD HH:mm:ss' ), result, proposalId, voteType]
        )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error when inserting a record.' );
                throw new Error();
            } );
    }

    // Method to check when the last Digest or Simple list post was made.
    async checkLastPost( type: number ): Promise<boolean> {
        let dateMoment = moment().utc();
        let date: string;

        if ( type === POST_TYPES.digest ) {
            // Checking if digest was already posted within some time window.
            date = dateMoment.add( -Number( process.env.POST_RETRY_TIME ), 'minutes' )
                .format( 'YYYY-MM-DD HH:mm:ss' );
        } else if ( type === POST_TYPES.active_simple ) {
            // This post type maybe required later, but currently is commented out in the index.ts file,
            // until the further decision is made if this extra post makes sense.

            // List of simple votes is posted again in 12h.
            date = dateMoment.add( -12, 'hours' )
                .format( 'YYYY-MM-DD HH:mm:ss' );
        }

        const query = 'SELECT id FROM posts WHERE type=? AND result=? AND DATE>?';
        const result = await this.query( query, [type, 1, date] )
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
    ): Promise<boolean> {
        const query = 'SELECT id FROM posts WHERE type=? AND result=? AND proposal_id=? AND vote_type=?';
        const result = await this.query( query, [postType, 1, proposalId, voteType] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error when checking for records.' );
                throw new Error();
            } );

        return !!result.length;
    }

    // Check if there was already an extra alret about the failed proposal.
    async checkFailedPost( proposalId: number ): Promise<boolean> {
        const query = 'SELECT id FROM posts WHERE type=? AND result=? AND proposal_id=?';
        const result = await this.query( query, [POST_TYPES.failed_no_quorum, 1, proposalId] )
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
