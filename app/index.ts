import { Digest } from './digest'
import { Telegraf } from 'telegraf'
import dotenv from 'dotenv';
import { DbClient } from './db-client';
import moment from 'moment';
import { logger } from './logger';

dotenv.config();

const bot = new Telegraf( process.env.BOT_TOKEN )
const digest = new Digest();
const dbClient = new DbClient();

async function checkLoop(): Promise<void> {

    // if it's time for a digest, and it wasn't posted already.
    if ( await checkForDailyDigestTime() ) {
        // Always list Simple votes before the digest.
        await postMessage( await digest.listSimple(), 1 );
        await postMessage( await digest.createDigest(), 0 );
    } else {
        // Post simple votes list again in 12h after the last post.
        if ( !await dbClient.checkLastPost( 1 ) ) {
            await postMessage( await digest.listSimple(), 1 );
        } else {
            logger.debug( 'Simple list has been already posted recently.' );
        }
    }

}

async function postMessage( digestText: string, type: number ): Promise<void> {
    if ( !digestText.trim().length ) {
        logger.debug( 'Nothing to post.' );
        return;
    }

    logger.debug( digestText );

    // Unlikely to happen, but prevent exceeding the message size limit;
    if ( digestText.length > 4095 ) {
        logger.error( 'Too long message.' );
        digestText = digestText.substring( 0, 4095 ) + '…';
    }

    const result = await bot.telegram.sendMessage( Number( process.env.CHAT_ID ), digestText, {
        parse_mode: 'MarkdownV2',
    } ).catch( error => {
        logger.warn( error );
    } );

    if ( result ) {
        logger.info( 'Successfully posted.' );
        await dbClient.post( type, 1, 0 );
    } else {
        logger.error( 'Failed to post message.' );
        await dbClient.post( type, 0, 0 );
    }
}

async function checkForDailyDigestTime(): Promise<boolean> {
    const digestTime = moment().utc()
        .hours( Number( process.env.DIGEST_TIME_H ) )
        .minutes( Number( process.env.DIGEST_TIME_M ) )
        .seconds( 0 );

    if (
        moment().utc().isSameOrAfter( digestTime ) &&
        moment().utc().isBefore( digestTime.clone().add( process.env.POST_RETRY_TIME, 'minutes' ) )
    ) {
        logger.info( 'Time to post Daily Digest.' )
        if ( await dbClient.checkLastPost( 0 ) ) {
            logger.debug( 'Digest has been already posted, skipping.' );
            return false;
        }
    } else {
        logger.debug( 'Not the right time to post digest.' );
        return false;
    }
    return true;
}

// Launch the bot.
bot.launch().then( async () => {
    logger.info( 'Bot started successfully.' );
    await checkLoop();
    setInterval(
        async () => { await checkLoop(); },
        Number( process.env.CHECK_INTERVAL ) * 60000
    );
} );

// Enable graceful stop.
process.once( 'SIGINT', () => bot.stop( 'SIGINT' ) )
process.once( 'SIGTERM', () => bot.stop( 'SIGTERM' ) )
