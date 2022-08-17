import { Digest } from './digest'
import { Telegraf } from 'telegraf'
import dotenv from 'dotenv';
import { DbClient } from './db-client';
import moment from 'moment';
import { logger } from './logger';
import { ICONS, POST_TYPES, VOTE_TYPES } from './constants';
import { Interact } from "./interact";

dotenv.config();

// The Telegram bot object wrapped into Telegraf library.
const bot = new Telegraf( process.env.BOT_TOKEN )

// Class that gathers, filters information and creates text using Markdown v.2 syntax.
const digest = new Digest();

// This handles operation with the database.
const dbClient = new DbClient();

// Check if anything needs to be posted. This loop is set to run periodically.
async function checkLoop(): Promise<void> {
    logger.debug( 'New check cycle.' );

    // Post immediately about entering informal or formal voting.
    await newProposalPost();

    // Post immediately about completed votes failed because of no-quorum.
    await failedListPost();

    // Extra alert about active Simple votes with no quorum.
    await noQuorumListPost();

    // If it's time for a digest, and it wasn't posted already.
    if ( await checkForDailyDigestTime() ) {
        await digestPost();

        // Always list Simple/Admin votes after the digest.
        await simpleAdminListPost();
    }

    // Specific proposals that user follows entered a new informal/formal voting phase.
    const chatIdsToPostNewCustom = await dbClient.subscribedChats( 'proposals' );
    for ( const chatId of chatIdsToPostNewCustom ) {
        await newProposalPost( chatId, true );
    }

    // Send notifications about any proposals entered informal or formal voting.
    const chatIdsToPostNew = await dbClient.subscribedChats( 'informal-formal' );
    for ( const chatId of chatIdsToPostNew ) {
        await newProposalPost( chatId );
    }

    // Send notifications failed with no-quorum votes or expiring simple with no-quorum..
    const chatIdsToPostExtra = await dbClient.subscribedChats( 'extra' );
    for ( const chatId of chatIdsToPostExtra ) {
        await failedListPost( chatId );
    }

    // Send private Digest to the subscribers, according to their settings.
    const chatIdsToPostDigest = await dbClient.subscribedChats( 'digest' );
    for ( const chatId of chatIdsToPostDigest ) {
        await digestPost( chatId );
        await noQuorumListPost( chatId );
    }
}

// Make the Digest post, unless the generated text is empty.
async function digestPost( chatId = 0 ): Promise<void> {
    // Create the Digest.
    let digestText = await digest.createDigest();
    if ( digestText.length ) {
        digestText = ICONS.digest + ' \*Daily Digest*\n\n' + digestText;
        await postMessage( digestText, POST_TYPES.digest, [], [], chatId );
    }
}

// Make a post with the list of active simple/admin-grants. Only if there are any.
async function simpleAdminListPost(): Promise<void> {
    let votesListText = await digest.listSimpleAdmin();
    if ( votesListText.length ) {
        votesListText = ICONS.simple + ' \*Active Simple/Admin*\n\n' + votesListText;
        await postMessage( votesListText, POST_TYPES.active_simple );
    }
}

// Post about simple/admin votes that expire soon and have no quorum.
async function noQuorumListPost( chatId = 0 ): Promise<void> {
    const expiringSimple = await digest.expiringSimpleAdminNoQuorum( chatId );
    if ( expiringSimple.text.length ) {
        logger.info( 'Expiring simple/admin votes with no quorum.' );
        // We also pass the ids, to be able to store them and prevent a duplicated post.
        await postMessage(
            expiringSimple.text,
            POST_TYPES.expiring_simple,
            expiringSimple.informalIds,
            expiringSimple.formalIds,
            chatId,
        );
    }
}

// Make a separate post about failed proposals with no quorum and pass their ids to save.
async function failedListPost( chatId = 0): Promise<void> {
    const newFailedVotes = await digest.newFailedNoQuorum( chatId );
    if ( newFailedVotes.text.length ) {
        logger.info( 'New failed completed votes with no quorum.' );
        await postMessage(
            newFailedVotes.text,
            POST_TYPES.failed_no_quorum,
            newFailedVotes.votesIds,
            [],
            chatId,
        );
    }
}

// Post about the proposals that entered a new voting phase and pass their ids, so we can save them.
async function newProposalPost( chatId = 0, proposalsMode = false ): Promise<void> {
    const newVotes = await digest.newProposal( chatId, proposalsMode );
    if ( newVotes.text.length ) {
        // Check if there was already a post about each new proposal.
        logger.info( 'New votes moved to informal or formal for ' + chatId );
        await postMessage(
            newVotes.text,
            POST_TYPES.new_simple,
            newVotes.informalIds,
            newVotes.formalIds,
            chatId,
        );
    }
}

// Post to Telegram and save the result. In case of new Simple votes, save their ids as well.
async function postMessage(
    digestText: string,
    type: number,
    informalIds: number[] = [],
    formalIds: number[] = [],
    chatId = 0,
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

    logger.debug( 'Posting to: ' + chatId + ' ' + digestText );

    // Sent the message to Telegram to the specified Channel (Chat) and get the result.
    const result = await bot.telegram.sendMessage( chatId || Number( process.env.CHAT_ID ), digestText, {
        parse_mode: 'MarkdownV2',
    } ).catch( error => {
        logger.warn( error );
    } );

    // If the post was successful.
    if ( result ) {
        logger.info( 'Successfully posted.' );
        // Save ids of new Simple votes, to prevent posting about them again.
        if ( type === POST_TYPES.new_simple ) {
            for ( const id of informalIds ) {
                await dbClient.post( type, 1, id, VOTE_TYPES.informal, chatId );
            }
            for ( const id of formalIds ) {
                await dbClient.post( type, 1, id, VOTE_TYPES.formal, chatId );
            }
        } else if ( type === POST_TYPES.failed_no_quorum || type === POST_TYPES.expiring_simple ) {
            // Save ids of failed no-quorum votes.
            for ( const id of informalIds ) {
                await dbClient.post( type, 1, id, VOTE_TYPES.informal, chatId );
            }
            for ( const id of formalIds ) {
                await dbClient.post( type, 1, id, VOTE_TYPES.formal, chatId );
            }
        } else {
            // Save that digest was posted successfully.
            await dbClient.post( type, 1, 0, 0, chatId );
        }

    } else {
        // Save that there was a failed attempt to post the message.
        logger.error( 'Failed to post message.' );
        await dbClient.post( type, 0, 0 , 0 , chatId );
    }
}

// Check the schedule if it's a correct time to make a post.
async function checkForDailyDigestTime( simple = false ): Promise<boolean> {
    let digestTime = moment().utc()
        .hours( Number( process.env.DIGEST_TIME_H ) )
        .minutes( Number( process.env.DIGEST_TIME_M ) )
        .seconds( 0 );

    if ( simple ) {
        // If digest time is set after 12, it becomes the next day, so we subtract 12h then.
        digestTime = digestTime.add( Number( process.env.DIGEST_TIME_H ) > 12 ? -12 : 12, 'hours' );
    }

    // If the current time is within the time to post Digest and the retry interval.
    if (
        moment().utc().isSameOrAfter( digestTime ) &&
        moment().utc().isBefore( digestTime.clone().add( process.env.POST_RETRY_TIME, 'minutes' ) )
    ) {
        // Retry posting during the defined time window.
        if ( await dbClient.checkLastPost( simple ? POST_TYPES.active_simple : POST_TYPES.digest ) ) {
            // Digest has been already posted, skipping.
            return false;
        }
        if ( simple ) {
            logger.info( 'Time to post Simple list.' );
        } else {
            logger.info( 'Time to post Daily Digest and Simple list.' );
        }

    } else {
        // Not the right time to post digest.
        return false;
    }
    return true;
}

// Handle interactive part.
new Interact( bot, digest, dbClient );

// Launch the bot.
bot.launch().then( async () => {
    logger.info( 'Bot started successfully.' );

    await checkLoop()
        .catch( error => {
            logger.error( error );
            process.exit( 1 );
        } );
    // Set the interval to run through the loop periodically, as set in CHECK_INTERVAL.
    setInterval(
        async () => {
            // As network errors may happen when API is down, we gracefully exit the process.
            // PM2 takes care with relaunching it with increasing intervals to prevent any extra load.
            // When app is stable for 30 seconds that increasing timer is reset automatically.
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
