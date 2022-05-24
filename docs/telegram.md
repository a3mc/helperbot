
* **1.1 Create your Telegram Bot**

Telegram allows you to easily create your own Bot with the help of **@BotFather**.

Use the **/newbot** command to create a new bot. 

The **BotFather** will ask you for a name and username, then generate an **authorization token** for your new bot.

The name of your bot is displayed in contact details and elsewhere.

The Username is a short name, to be used in mentions and telegram.me links. Usernames are 5-32 characters long and are case insensitive, but may only include Latin characters, numbers, and underscores. 

Your bot's username must end in ‘bot’, e.g. ‘_tetris_bot_’ or ‘_TetrisBot_’.

The token is a string along the lines of **110201543:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw** that is required to authorize the bot and send requests to the Bot API. **Keep your token secure** and store it safely, it can be used by anyone to control your bot.

* **1.2 Get Channel ID**

First, from your Telegram client, create a channel and **keep it public** as you need to obtain the channel ID. Give a name **@YourNewChannelName** to your channel.

Next, from your Bot thread, go to the Bot parameters page. You should see that your Bot is in both **Members** and **Administrators** list.

The Bot is now ready to publish messages.

To get your **channel ID**, you just need to send a message to **@YourNewChannelName** from any web browser using your **Bot API** key :

**Send:** `https://api.telegram.org/bot123456789:AABBCCDD_abcdefghijklmnopqrstuvwxyz/sendMessage?chat_id=@YourNewChannelName&text=FirstMessage`

**Answer:** `{"ok":true, "result":{"message_id":2, "chat":{"id":-1234567890123, "title":"Your Channel", "username":"YourNewChannelName", "type":"channel"}, "date":1483383169, "text":"FirstMessage"}}` 

You can **see in the resulting JSON** string that your new channel ID is **-1234567890123**.

You can now edit your Channel and **convert its type to Private**.

Your Bot can still send a message to the channel using the **Channel ID**
