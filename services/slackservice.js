import db from '../models/index.js';
import dotenv from 'dotenv';
import pkg from '@slack/bolt';

dotenv.config();
const { App,  ExpressReceiver } = pkg;
const receiver = new ExpressReceiver({ signingSecret: process.env.SLACK_SIGNING_SECRET });
// Load environment variables from .env file

let app; 
if (process.env.SLACK_ENV == "test"){

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


async function updateFile(userId, fileId, channelId, email) {
 
  const [user, created] = await db.SlackUser.findOrCreate({
    where: {
      user_id: userId,
      deleted: "FALSE"
    },
    defaults: { 
      user_id: userId,
      email: email,
      created: new Date(),
      updated: new Date(),
      last_use: new Date(),
      channel_id: channelId
    } 
  });


  const updateFile = await user.update({
    file: fileId
  });

  if (updateFile) {
    return updateFile;
  } else {
    throw new Error("Upload failed");
  }
}



async function searchFileId(userId) {
 
  try {
    const user = await db.SlackUser.findOne({
      where: {
        user_id: userId,
        deleted: "FALSE"
      },
      attributes: ['file']  // Only fetch the 'file' field
    });

    if(user){ 
    if (user.file) {
      return user.file;  // Return the fileId
    }else{
      throw new Error("No file found for user. Please upload your file for analysis");
    }

  }else{
    throw new Error("No file found for user. Please upload your file for analysis");
  }
  } catch (error) {
    console.error('Error searching for file:', error.message);
    throw error;  
  }
}


async function getUserEmail(userId, token) {
  
  try {
    // Call the users.info method using the WebClient with the token in the header
    const result = await app.client.users.info({
      token: token, 
      user: userId// The user ID you are looking up
    });
    
    // Check if email exists in the user profile
    if (result.user && result.user.profile && result.user.profile.email) {
      return result.user.profile.email;
    } else {
      console.log('No email found for this user');
      return null;
    }
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

async function findEmailByUserId(userId) {
  try {
    // Search for a user by their user_id
    const user = await db.SlackUser.findOne({
      where: {
        user_id: userId,
        deleted: "FALSE"
      }
    });

    if (user) {
      // If user is found, return the email
      return user.email;
    } else {
      // If no user is found, return null or a custom message
      console.log('No user found with this user_id');
      return null;
    }
  } catch (error) {
    console.error('Error searching for user by user_id:', error);
    throw error;
  }
}

async function findTokenByTeamId(teamId) {
  try {
    // Search for a Slack token record by the provided team_id
    const tokenRecord = await db.SlackToken.findOne({
      where: {
        team_id: teamId
      }
    });

    if (tokenRecord) {
      // If a token record is found, return it
      return tokenRecord;
    } else {
      // If no token record is found, return null or handle accordingly
      console.log(`No token found for team_id: ${teamId}`);
      return null;
    }
  } catch (error) {
    console.error('Error fetching token by team_id:', error);
    throw error; // You can decide to throw the error or handle it differently
  }
}

export {updateFile, searchFileId, getUserEmail, findEmailByUserId, findTokenByTeamId};


