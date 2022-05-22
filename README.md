# Distressing Helper Bot

#### An alert bot designed specifically for DevDao workflows, to send alerts to the Telegram channel about specific events.

### Requirements

The bot requires the following to be installed on your system:

- NodeJS 16+
- Mysql 8+ (You'll have to create a database and a user)
- PM2
- A new Telegram bot
- Telegram channel (and you know it's id)

### Installation - Quick Start
###### That assumes your setup already meets the requirements above. For a step-to step guide please refer to the full installation doc in the `/docs` folder that includes creating a Telegram Bot, preparing MSQL user, etc.

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

6. To build the project and start the bot for development or test purposes run:

```shell
$ npm start
```

7. To start the bot in the background in production mode, set it up with:
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

The Bot signs in to the DevDao portal and collects information about votes and proposals. It posts a daily digest once a day. If there are some active simple votes it will also make an additional post in 12h after the digest. In some cases it may make extra posts when addition attention is required, for example, when a new Simple enters Informal or Formal voting.

The Digest may include the following:

- List of active proposals that didn't reach quorum yet and are ending soon.
- List of discussions that have attestation rate higher than some defined value, but still lack some attention.
- Discussions that will reach their 90 days life cycle soon and will expire.
- Dead discussion that have to be cleaned up.

A special attention is paid to the short-living but important Simple votes. All active simple votes are posted with a digest.
When a simple vote is ending in a few hours, but didn't reach a quorum, an extra alert is posted to attract VAs attention.
There's a separate notification when a new Simple just entered Informal or Formal.
There's also a post about any voting that failed because of no quorum.

All messages are posted to a private Telegram chat, specified in the `.env` file.

Some interactivity with ability to customize the alerts will be delivered in the next Milestone of the current project.

### Contributing and Code of Conduct

You are welcome to add your suggestions and to contribute to the project. Please create PRs against develop branch if you want to contribute. We reserve the right to ignore or decline any PRs and not to respond to the messages.

Please follow the best practices, follow the code structure and make sure that your suggestion is really valuable for the project and well-formed. When you open an issue, please make sure you provide enough details on how to reproduce it. Don't use explicit lexis and be polite to other members.

### License

This project is licensed under MIT license.

### About us:
* [ART3MIS.CLOUD](https://art3mis.cloud)
