import moment from 'moment';
import { logger } from './logger';
import mysql from 'mysql';
import util from 'util';
import { POST_TYPES } from './constants';

export class DbClient {
    protected pool = mysql.createPool( {
        connectionLimit: 10,
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
    } );
    protected query = util.promisify( this.pool.query ).bind( this.pool );

    async post( type: number, result: number, proposalId= 0, voteType = 0  ): Promise<void> {
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

    async checkLastPost( type: number ): Promise<boolean> {
        let dateMoment = moment().utc();
        let date: string;

        if ( type === POST_TYPES.digest ) {
            // Checking if digest was already posted within some time window.
            date = dateMoment.add( -Number( process.env.POST_RETRY_TIME ), 'minutes' )
                .format( 'YYYY-MM-DD HH:mm:ss' );
        } else if ( type === POST_TYPES.active_simple ) {
            // List of simple votes is posted again in 12h. We add some extra to prevent possible duplication.
            date = dateMoment.add( -12, 'hours' ).add( - Number( process.env.POST_RETRY_TIME ), 'minutes' )
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

    async checkSimplePost(
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

    async migrate( query: string ): Promise<void> {
        const result = await this.query( query )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error executing migration script.' );
                throw new Error();
            } );
    }
}
