# Create the Discord application

Three values from the [Discord Developer Portal](https://discord.com/developers/applications) and
one from your Discord client. About ten minutes the first time.

## 1. The application and the bot token

1. Open the [Developer Portal](https://discord.com/developers/applications) and click **New
   Application**. The name is what users see next to the reply.
2. On **General Information**, copy the **Application ID** into `DISCORD_APP_ID`.
3. Open the **Bot** tab and click **Reset Token**. Copy the token into `DISCORD_TOKEN`. It is shown
   once; if you lose it, reset it again.
4. Leave every **Privileged Gateway Intent** off. The bot answers a slash command, which needs only
   the Guilds intent, and that one is not privileged.

## 2. Invite the bot to a server

On **OAuth2 → URL Generator** tick the scopes `bot` and `applications.commands`, and under bot
permissions tick **Send Messages** and **Embed Links**. Open the generated URL and pick the server.
The same link with your application id filled in:

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot%20applications.commands&permissions=18432
```

`18432` is Send Messages plus Embed Links.

## 3. The server id (optional)

With `DISCORD_GUILD_ID` set, `/price` is registered on that one server and appears at once. Without
it the command is registered globally, which Discord takes up to an hour to show everywhere. To get
the id: **User Settings → Advanced → Developer Mode** on, then right-click the server icon → **Copy
Server ID**.

Use a guild id while testing, then empty it when the bot goes to many servers.

## 4. Run it

Copy `.env.example` to `.env`, fill it in, then `npm ci && npm start`. When the process prints
`Logged in as …`, type `/price` in a channel of that server.

## If the command does not show up

- The bot was invited without the `applications.commands` scope: open the invite link from step 2
  again.
- The command went to another server: it is registered on the guild in `DISCORD_GUILD_ID` only.
- The Discord client caches the command list: press Ctrl+R (Cmd+R on macOS).
- The reply says the bot "is not configured with a working API key": `ALLTCG_API_KEY` is missing,
  wrong or revoked. The process log has the API's error code.
