import pkg from '@slack/bolt';
import dotenv from 'dotenv';
import db from './models/index.js';
import {updateFile, searchFileId, findTokenByTeamId} from './services/slackservice.js'
import {handleExcelCommand, sendFileToGemini, handleSpreadsheetCommand, getUserEmail, analyzeFileFromSlack} from './services/filereader.js'
import axios from 'axios';

const { App,  ExpressReceiver } = pkg;

const receiver = new ExpressReceiver({ 
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true
});


dotenv.config();


async function getBotTokenForTeam(teamId) {
  try {
    // Query the database for the bot token using the teamId
    const tokenRecord = await db.SlackToken.findOne({ where: { team_id: teamId } });
    
    if (!tokenRecord) {
      throw new Error('Bot token not found for the specified team ID');
    }

    // Return the bot token
    return tokenRecord.bot_token;
  } catch (error) {
    console.error('Error fetching bot token:', error);
    throw new Error('Failed to retrieve bot token');
  }
}

let app; 
if (process.env.SLACK_ENV == "test"){

  //this is for single workspace.

// Initializes your app with credentials
     app = new App({
      token: process.env.SLACK_BOT_TOKEN,
      socketMode: process.env.SOCKET_MODE === "true",
      appToken: process.env.APP_TOKEN,
      signingSecret: process.env.SLACK_SIGNING_SECRET //,
      //receiver
    });

}else{
  
   app = new App({
    socketMode: true,
    appToken: process.env.APP_TOKEN,
    authorize: async ({ teamId, enterpriseId }) => {
      try {
        // Fetch the bot token from the database
        const botToken = await getBotTokenForTeam(teamId);
        
        // Return the botToken to be used for this authorization
        return { botToken };
      } catch (error) {
        console.error('Authorization failed:', error);
        throw new Error('Authorization failed');
      }
    },
  });
}




app.message(async ({ message, say, client}) => {

   // Check if the message was sent by the bot itself
   const botInfo = await client.auth.test();
    if (message.user === botInfo.user_id) {
      console.log('Ignoring message from the bot itself');
      return; 
    }
   
   
      let prompt = message.text.trim();
      let fileId;
      try {
         fileId = await searchFileId(message.user)
      } catch (error) {
        fileId = null; 
      }
  
      if ((fileId != null && fileId)){ 
       
        try {
              
          if (message.files && message.files.length > 0) {  
          let teamId = message.team || message.files[0].user_team
          const tokenRecord = await findTokenByTeamId(teamId)
           let uploadedFile = await sendFileToGemini(message.files[0].url_private_download, message.files[0].name, tokenRecord.bot_token);
      
           if(uploadedFile){     
             
              let slackEmail = await getUserEmail(message.user, tokenRecord.bot_token);
              await updateFile(message.user, uploadedFile, message.channel, slackEmail)

              await say({ text: "Your file is ready! Feel free to ask me anything about it" });
             
           }else{
              await say({ text: `Something has gone wrong with the file upload. Retry or contact support`});
           }
        
       
          }else{
       
             let analyze = await analyzeFileFromSlack(prompt, message.user)
             
              let formattedMessage = "No content available.";

              if (analyze && analyze.trim()) {          
                
                  const sqlRegex = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT|SET|EXEC|EXECUTE|DECLARE|BEGIN|END)\b/i;

                  if (sqlRegex.test(analyze)) {  

                      formattedMessage = `\`\`\`sql\n${analyze}\n\`\`\``.replace(/^\s*```sql\s*/i, '').replace(/\s*```\s*$/i, '').trim();;
                    
                } else {
                      // Send as regular text
                      formattedMessage = analyze;
                  }
              }

            await say({ text: formattedMessage });

          }
        

      }catch(err){       
         
            if(err.message == "INCOMPATIBLE_FILE_FORMAT"){
              await say({ text: "Filetype not supported. Upload a csv, json, db or sql file format. Please contact support if issue persists" });
            }else{
              await say({ text: "Something went wrong with the file upload. Please re-upload or contact support if issue persists" });
            }
            
      }           
    
  }else{
    
  
    if (message.files && message.files.length > 0) {
     
      let teamId = message.team || message.files[0].user_team
      const tokenRecord = await findTokenByTeamId(teamId)
  
      let uploadedFile = await sendFileToGemini(message.files[0].url_private_download, message.files[0].name, tokenRecord.bot_token);
      
      if(uploadedFile){        
         
         let slackEmail = await getUserEmail(message.user, tokenRecord.bot_token);
         await updateFile(message.user, uploadedFile, message.channel, slackEmail)
         await say({
          blocks: [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "*File ready! Here’s how you can interact with it:*"
              }
            },
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "- *Ask questions* about the data directly, and I’ll provide insights."
              }
            },
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "- Use `/excel` to generate an *Excel spreadsheet* from the data."
              }
            },
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": "- Use `/spreadsheet` to generate a *Google Spreadsheet* from the data."
              }
            }
          ]})

      }else{
         await say({ text: "Something has gone wrong with the file upload. Retry or contact support" });
      }
      
    }else{
      await say({text: "Please upload your data file to get started with Decide."})
 
    }  

  }


});



app.command('/spreadsheet', handleSpreadsheetCommand);
app.command('/excel', handleExcelCommand);

receiver.router.get("/slack/oauth_redirect", async (req, res) => {
  const { code } = req.query;
 

  try {
    const tokenResponse = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      null,
      {
        params: {
          code,
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          redirect_uri: "https://decidebot-9eba3a4c0e68.herokuapp.com/slack/oauth_redirect",
        },
      },
    );

    if (tokenResponse.data.ok) {
      console.log('tokenResponse.data', tokenResponse.data);

      const { access_token: bot_token } = tokenResponse.data;
      const { access_token: app_token } = tokenResponse.data.authed_user;
      const { id: team_id } = tokenResponse.data.team;  // Extracting team_id

      // Check if a record for this team_id already exists
      const existingToken = await db.SlackToken.findOne({
        where: { team_id },  // Searching by team_id
      });

      if (existingToken) {
        // Update the existing record with the new app_token and bot_token
        await existingToken.update({
          bot_token,
          app_token, // Update app_token if necessary
          deleted_at: null, // Reset deleted_at if updating
          updated_at: new Date(), // Update timestamp for record modification
        });
      } else {
        // Create a new record if no existing team_id is found
        await db.SlackToken.create({
          team_id,  // Store the team_id
          bot_token,
          app_token, // Store both tokens
          created_at: new Date(),
          deleted_at: null,
        });
      }

      // Respond with the success message
      res.send(`
        <html>
          <body>
          <h1>Success!</h1>
            <p>Decide has been successfully connected to your workspace. You can close this page.</p>
          </body>
        </html>
      `);
    } else {
      res
        .status(500)
        .send("Error authorizing with Slack: " + tokenResponse.data.error);
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("Server error when exchanging code.");
  }
});


receiver.router.get("/auth/slack", (req, res) => {
  const scopes = "chat:write,commands,files:read,files:write,im:history,im:read,im:write,users:read.email,users:read";
  res.redirect(
    `https://slack.com/oauth/v2/authorize?client_id=${
      process.env.SLACK_CLIENT_ID
    }&user_scope=${encodeURIComponent(
      scopes,
    )}&redirect_uri=${encodeURIComponent("https://decidebot-9eba3a4c0e68.herokuapp.com/slack/oauth_redirect")}`,
  );
});




(async () => {
  const port = process.env.PORT || 5000;
  await receiver.start(port);
  await app.start(port);
  console.log(`Bolt app is running on port ${port}`);
})();
