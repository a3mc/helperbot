import { Digest } from './digest'
import { Telegraf } from 'telegraf'
import dotenv from "dotenv";
import { DbClient } from "./db-client";
import moment from "moment";

dotenv.config();

const bot = new Telegraf( process.env.BOT_TOKEN )
const digest = new Digest();

const dbClient = new DbClient();


setTimeout( () => {
    checkLoop()
}, 1000 );
setInterval( async () => {
    await checkLoop();
}, 60000 );


async function checkLoop(): Promise<void> {
    // if it's time for a digest, and it wasn't posted already

    const digestTime = moment().utc()
        .hours( Number( process.env.DIGEST_TIME_H ) )
        .minutes( Number( process.env.DIGEST_TIME_M ) )
        .seconds( 0 );

    console.log( digestTime.format(), moment.utc().format() )

    if (
        moment().utc().isSameOrAfter( digestTime ) &&
        moment().utc().isBefore( digestTime.clone().add( process.env.POST_RETRY_TIME, 'minutes' ) )
    ) {
        console.log( 'Time to post Daily Digest.', digestTime.format() )
        if ( await dbClient.checkLastDigest() ) {
            console.log( 'Digested has been already posted, skipping.' );
            return;
        }
    } else {
        console.log( 'Not the right time to post digest' );
        return;
    }


    let digestText = await digest.createDigest();
    //let digestText = await digest.listSimple();

    if ( !digestText.trim().length ) {
        console.log( 'Nothing to post.' );
        return;
    }

    console.log( digestText );

    // Unlikely to happen, but prevent exceeding the message size limit;
    if ( digestText.length > 4095 ) {
        console.warn( 'Too long message.' );
        digestText = digestText.substring( 0, 4095 ) + '…';
    }

    const result = await bot.telegram.sendMessage( Number( process.env.CHAT_ID ), digestText, {
        parse_mode: 'MarkdownV2',
    } ).catch( error => {
        console.warn( error );
    } );

    if ( result ) {
        console.log( 'Successfully posted.' );
        await dbClient.post( 0, 1, 0 );
    } else {
        console.error( 'Failed to post message.' );
        await dbClient.post( 0, 0, 0 );
    }

    // await bot.telegram.sendSticker(
    //     '@devhelpertest',
    //     'CAACAgEAAxkBAAET5qJie5ue0njEC3iAvl66SVQw_HW0wgACEQEAAnm8NAxPdSOD2aqq0yQE',
    //     {
    //         disable_notification: true
    //     } );
}

// bot.on( 'text', async ( ctx ) => {
//     // Explicit usage
//     ctx.telegram.sendMessage(
//         ctx.message.chat.id,
//         await digest.createDigest(),
//         { parse_mode: 'MarkdownV2' }
//     );
// } )

// Launch the bot.
bot.launch().then( () => {
    console.log( 'Bot started.' );
} );

// Enable graceful stop.
process.once( 'SIGINT', () => bot.stop( 'SIGINT' ) )
process.once( 'SIGTERM', () => bot.stop( 'SIGTERM' ) )
