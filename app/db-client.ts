import moment from "moment";
import { logger } from "./logger";

const mysql = require( 'mysql' );
const util = require( 'util' );

export class DbClient {
    protected pool = mysql.createPool( {
        connectionLimit: 10,
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    } );

    protected query = util.promisify( this.pool.query ).bind( this.pool );

    constructor() {
    }

    async post( type: number, result: number, action: number ): Promise<void> {
        const query = 'INSERT INTO posts (type, date, result, action) VALUES (?, ?, ?, ?)';
        await this.query( query, [type, moment().utc().format( 'YYYY-MM-DD HH:mm:ss' ), result, action] )
            .catch( error => {
                logger.warn( error );
                logger.error( 'MySQL error when inserting a record.' );
                throw new Error();
            } );
    }

    async checkLastPost( type: number ): Promise<boolean> {
        let dateMoment = moment().utc();
        let date: string;

        if ( type === 0 ) {
            // Checking if digest was already posted within some time window.
            date = dateMoment.add( -Number( process.env.POST_RETRY_TIME ), 'minutes' )
                .format( 'YYYY-MM-DD HH:mm:ss' );
        } else if ( type === 1 ) {
            // List of simple votes is posted again in 12h. We add extra 10 minutes to prevent possible duplication.
            date = dateMoment.add( -12, 'hours' ).add( -10, 'minutes' )
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


}
