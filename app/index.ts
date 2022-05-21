import { Digest } from './digest'
import { Telegraf } from 'telegraf'
import dotenv from 'dotenv';
import { DbClient } from './db-client';
import moment from 'moment';
import { logger } from './logger';
import { POST_TYPES, VOTE_TYPES } from './constants';

dotenv.config();

const bot = new Telegraf( process.env.BOT_TOKEN )
const digest = new Digest();
const dbClient = new DbClient();

// Check if anything needs to be posted.
async function checkLoop(): Promise<void> {
    // If it's time for a digest, and it wasn't posted already.
    if ( await checkForDailyDigestTime() ) {
        // Always list Simple votes before the digest.
        await postMessage( await digest.listSimple(), POST_TYPES.active_simple );
        await postMessage( await digest.createDigest(), POST_TYPES.digest );
    } else {
        // Post simple votes list again in 12h after the last post.
        if ( !await dbClient.checkLastPost( POST_TYPES.active_simple ) ) {
            await postMessage( await digest.listSimple(), POST_TYPES.active_simple );
        } else {
            // Post immediately about a new simple entering informal or formal voting.
            const newSimpleVotes = await digest.newSimple();
            if ( newSimpleVotes.text.length ) {
                // Check if there was already a post about each new simple vote.
                logger.info( 'New simple votes' );
                await postMessage(
                    newSimpleVotes.text,
                    POST_TYPES.new_simple,
                    newSimpleVotes.informalIds,
                    newSimpleVotes.formalIds
                );
            }

            // Post immediately about completed votes failed because of no-quorum.
            const newFailedVotes = await digest.newFailedNoQuorum();
            if ( newFailedVotes.text.length ) {
                // Check if there was already a post about each failed vote.
                logger.info( 'New failed votes with no quorum.' );
                await postMessage(
                    newFailedVotes.text,
                    POST_TYPES.failed_no_quorum,
                    newFailedVotes.votesIds,
                );
            }
        }
    }
}

// Post to Telegram and save the result. In case of new Simple votes, save their ids as well.
async function postMessage(
    digestText: string,
    type: number,
    informalIds: number[] = [],
    formalIds: number[] = []
): Promise<void> {
    if ( !digestText.trim().length ) {
        // Nothing to post.
        return;
    }

    // Unlikely to happen, but prevent exceeding the message size limit;
    if ( digestText.length > 4095 ) {
        logger.error( 'Too long message.' );
        digestText = digestText.substring( 0, 4090 );
        // Cut by the last line break.
        digestText = digestText.substring( 0, digestText.lastIndexOf( '\n' ) ) + '…';
    }

    logger.debug( digestText );

    const result = await bot.telegram.sendMessage( Number( process.env.CHAT_ID ), digestText, {
        parse_mode: 'MarkdownV2',
    } ).catch( error => {
        logger.warn( error );
    } );

    if ( result ) {
        logger.info( 'Successfully posted.' );
        // Save ids of new Simple votes, to prevent posting about them again.
        if ( type === POST_TYPES.new_simple ) {
            for ( const id of informalIds ) {
                await dbClient.post( type, 1, id, VOTE_TYPES.informal );
            }
            for ( const id of formalIds ) {
                await dbClient.post( type, 1, id, VOTE_TYPES.formal );
            }
        } else if ( type === POST_TYPES.failed_no_quorum ) {
            // Save ids of failed no-quorum votes.
            for ( const id of informalIds ) {
                await dbClient.post( type, 1, id );
            }
        } else {
            // Save that digest was posted successfully.
            await dbClient.post( type, 1 );
        }

    } else {
        // Save that there was a failed attempt to post the digest.
        logger.error( 'Failed to post message.' );
        await dbClient.post( type, 0 );
    }
}

// Check the schedule if it's a correct time to make a post.
async function checkForDailyDigestTime(): Promise<boolean> {
    const digestTime = moment().utc()
        .hours( Number( process.env.DIGEST_TIME_H ) )
        .minutes( Number( process.env.DIGEST_TIME_M ) )
        .seconds( 0 );

    if (
        moment().utc().isSameOrAfter( digestTime ) &&
        moment().utc().isBefore( digestTime.clone().add( process.env.POST_RETRY_TIME, 'minutes' ) )
    ) {
        // Retry posting during the defined time window.
        if ( await dbClient.checkLastPost( POST_TYPES.digest ) ) {
            // Digest has been already posted, skipping.
            return false;
        }
        logger.info( 'Time to post Daily Digest.' )
    } else {
        // Not the right time to post digest.
        return false;
    }
    return true;
}

// Launch the bot.
bot.launch().then( async () => {
    logger.info( 'Bot started successfully.' );
    await checkLoop()
        .catch( error => {
            logger.error( error );
            process.exit( 1 );
        } );
    setInterval(
        async () => {
            await checkLoop().catch( error => {
                logger.warn( error );
                process.exit( 1 );
            } );
        },
        Number( process.env.CHECK_INTERVAL ) * 60000
    );
} );

// Enable graceful stop.
process.once( 'SIGINT', () => bot.stop( 'SIGINT' ) )
process.once( 'SIGTERM', () => bot.stop( 'SIGTERM' ) )
