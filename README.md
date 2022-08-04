# Distressing Helper Bot

#### An alert bot designed specifically for DevDao workflows, to send alerts to the Telegram channel about specific events.

### Requirements

The bot requires the following to be installed on your system:

- NodeJS 16+ `( nvm install v16.15.0 )`
- Mysql 8+ (You'll have to create a database and a user)
- PM2 `( npm install -g pm2 )`
- A new Telegram bot and dedicated channel [how to](https://github.com/a3mc/helperbot/blob/master/docs/telegram.md)

### Installation - Quick Start
###### That assumes your setup already meets the requirements above. Check [docs folder](https://github.com/a3mc/helperbot/tree/master/docs) for additional information.

1. Install the packages:
```shell
$ npm install
```

2. Create a `.env` file from the `example.env` template:

```shell
$ cp example.env .env
```

3. Edit `.env`. All fields except the Telegram error alert bot details are required. Please see the comments in the `example.env` for more details.

4. Run the migration script. It will create a table in the database you've provided in the `.env` file.

```shell
$ npm run migrate
```

5. Run the unit tests. It uses mocked responses to simulate actual queries to the API.

```shell
$ npm test
```

Please keep in mind that tests are targeted on the default values provided in the `example.env`.

6. To start the bot in the background in production mode, set it up with:
```shell
$ npm run start:pm2
```

This will build and start the process under PM2. It will also start to output the logs to the console. To manage the project with PM2, please refer to the [PM2 documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
Here are a few PM2 commands you may find useful (`all` assumes that's the only project under PM2 control on your machine):
```shell
$ pm2 status
$ pm2 logs all
$ pm2 monit
$ pm2 stop all
$ pm2 reload all
```

### How The Bot Works

The Bot signs in to the DevDao portal and collects information about votes and proposals. It posts a daily digest once a day. In some cases it may make extra posts when addition attention is required, for example, when a new proposal enters Informal or Formal voting.

The Digest may include the following:

- List of active proposals that didn't reach quorum yet and are ending soon.
- List of recently completed votes with the result.
- List of discussions that have attestation rate higher than some defined value, but still lack some attention.
- Discussions that will reach their 90 days life cycle soon and will expire.
- Dead discussion that have to be cleaned up.

A special attention is paid to the short-living but important Simple and Admin-Grant votes. All such votes are posted with a separate digest.
When a simple or admin-grant vote is ending in a few hours, but didn't reach a quorum, an extra alert is posted to attract VAs attention.
There's a separate notification when a new proposal just entered Informal or Formal.
There's also a post about any voting that failed because of no quorum.

All messages are posted to a private Telegram chat, specified in the `.env` file.

### Interactive part

When the bot is accessed directly by its name, it allows user to start a private chat and modify the subscription settings or get the information immediately. 

The bot verifies if user is a member of the channel specified in `.env`. If not, it declines any requests. If user can use the bot, after pressing Start button a menu with the set of buttons is displayed. User can trigger some actions, for example get a Digest right at the moment. User can also use settings to set up custom subscriptions. For example, user can receive Digest on specific weekdays, at specific time and timezone. By using custom subscription user can mute the main notification channel and get updates only on the chosen weekdays instead.

### Contributing and Code of Conduct

You are welcome to add your suggestions and to contribute to the project. Please create PRs against develop branch if you want to contribute. We reserve the right to ignore or decline any PRs and not to respond to the messages.

Please follow the best practices, follow the code structure and make sure that your suggestion is really valuable for the project and well-formed. When you open an issue, please make sure you provide enough details on how to reproduce it. Don't use explicit lexis and be polite to other members.

You can find full details in the `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` files.

### License

This project is licensed under MIT license. 

### About us:
* [ART3MIS.CLOUD](https://art3mis.cloud)
