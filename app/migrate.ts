import dotenv from 'dotenv';
import fs from 'fs';
import { DbClient } from './db-client';
import { logger } from './logger';

dotenv.config();
const dbClient = new DbClient();

// We put it manually here to ensure they are executed in the right order.
// There's no reason to automate it further unless the project becomes a huge enough.
const migrationFiles = [
    '0_create_table_posts.sql',
    '1_create_table_preferences.sql',
    '2_create_table_proposals.sql',
];

// Read each file and pass it to dbClient, so it performs the query.
async function runMigrations() {
    for ( const migrationFile of migrationFiles ) {
        const queryData = fs.readFileSync(
            __dirname + '/../migrations/' + migrationFile,
            { encoding: 'utf8', flag: 'r' }
        );
        await dbClient.migrate( queryData );
    }
}

// This runs with a separate command and exits when done. It's not used within the normal lifecycle of the app.
runMigrations().then( () => {
    logger.info( 'Finished running migrations.' );
    process.exit( 0 );
} );
