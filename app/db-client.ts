import moment from "moment";

const mysql = require( 'mysql' );
const util = require( 'util' );

export class DbClient {
    protected connection = mysql.createConnection( {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
    } );

    protected query = util.promisify( this.connection.query ).bind( this.connection );

    constructor() {
        console.log( 'Db helper' );
        this.connect();
    }

    connect(): void {
        this.connection.connect( ( err ) => {
            if ( err ) {
                console.error( 'MySQL connection error occurred', err );
            } else {
                console.log( 'Connected to MySQL Server' );
                this.connection.query( 'USE ' + process.env.MYSQL_DATABASE );
            }
        } );
    }

    async post( type: number, result: number, action: number ): Promise<void> {
        const query = 'INSERT INTO posts (type, date, result, action) VALUES (?, ?, ?, ?)';
        await this.query( query, [type, moment().utc().format( 'YYYY-MM-DD HH:mm:ss' ), result, action] );
    }

    async checkLastDigest(): Promise<boolean> {
        const date = moment().utc().add( -Number( process.env.POST_RETRY_TIME ), 'minutes' ).format( 'YYYY-MM-DD HH:mm:ss' );
        const query = 'SELECT id FROM posts WHERE type=? AND result=? AND DATE>?';
        const result = await this.query( query, [0, 1, date] );
        return !!result.length;
    }

}
