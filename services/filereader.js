import axios from 'axios';
import { fileURLToPath } from 'url';
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import { exec } from 'child_process';
import util from 'util';
import ExcelJS from 'exceljs';
import {searchFileId, getUserEmail, findEmailByUserId} from './slackservice.js'
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import csvtojson from 'csvtojson';
import { google } from 'googleapis';
import JSON5 from 'json5';

dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

 
const fileManager = new GoogleAIFileManager(apiKey);
const genAI = new GoogleGenerativeAI(apiKey);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

async function downloadFile(fileUrl, downloadPath, token) {
    try {
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        // Ensure the directory exists
        const dir = path.dirname(downloadPath);
        await fs.promises.mkdir(dir, { recursive: true });

        // Write the file
        await fs.promises.writeFile(downloadPath, response.data);
      //  console.log(`File downloaded successfully to: ${downloadPath}`);
    } catch (error) {
        console.error('Error downloading file:', error.message);
        throw error; // Re-throw the error for the caller to handle
    }
}


async function convertToTxt(inputPath, outputPath) {
    try {
        const ext = path.extname(inputPath).toLowerCase();

        let text;
        if (ext === '.docx') {
            // Convert .docx to .txt
            const result = await mammoth.extractRawText({ path: inputPath });
            text = result.value;
        } else if (ext === '.pdf') {
            // Convert .pdf to .txt
            const dataBuffer = await fs.promises.readFile(inputPath);
            const pdfParse = await import('pdf-parse');
            const result = await pdfParse.default(dataBuffer);
            text = result.text;
        } else if (ext === '.csv') {
            // Convert .csv to JSON format and then to .txt
            const jsonArray = await csvtojson().fromFile(inputPath);
            text = JSON.stringify(jsonArray, null, 2);
        } else if (ext === '.sql') {
            // Read .sql file directly
            text = await fs.promises.readFile(inputPath, 'utf-8');
        } else {
            // If the file is already a text format or unsupported format, just read it directly
            text = await fs.promises.readFile(inputPath, 'utf-8');
        }

        // Write the converted text to the output file
        await fs.promises.writeFile(outputPath, text);
       // console.log(`File converted to txt: ${outputPath}`);
    } catch (error) {
        console.error('Error converting file to txt:', error);
        throw error;
    }
}

 


async function sendFileToGemini(fileUrl, originalFileName, token){

    const compatibleExtensions = ['.txt', '.csv', '.json', '.sql', '.db'];
    const fileExtension = path.extname(originalFileName).toLowerCase();
    const isCompatibleFile = compatibleExtensions.includes(fileExtension);

    if (isCompatibleFile) {
    const downloadPath = path.resolve(__dirname, originalFileName);
    const filename = 'converted_file.txt';
    const timestamp = new Date().getTime();
    const converted_file = `${filename.split('.')[0]}_${timestamp}.${filename.split('.')[1]}`;
    const txtPath = path.resolve(__dirname, converted_file);

    try {
        if (!fileUrl) {
            console.log('No file URL provided');
            return null;
        }
       // let token = await findTokenByTeamId(teamId)
       // console.log('okayyyy', token)
        // Start file download
        const downloadPromise = downloadFile(fileUrl, downloadPath, token);
      
        await downloadPromise;

        const fileStats = await fs.promises.stat(downloadPath);
        if (fileStats.size === 0) {
            throw new Error('Downloaded file is empty');
        }

        const convertPromise = convertToTxt(downloadPath, txtPath);       
        await convertPromise; 

        // Start the upload and AI processing in parallel
        let uploadPromise;
        try{

         uploadPromise = await fileManager.uploadFile(txtPath, {
            mimeType: "text/plain",
            displayName: "Converted Text File",
        });

        let fileUri = uploadPromise.file.uri;

        await Promise.all([
            fs.promises.unlink(downloadPath),
            fs.promises.unlink(txtPath)
        ]);

        return fileUri;

       }catch(error){
        await Promise.all([
            fs.promises.unlink(downloadPath),
            fs.promises.unlink(txtPath)
        ]);
       
     }

 } catch (error) {

    await Promise.all([
        fs.promises.unlink(downloadPath),
        fs.promises.unlink(txtPath)
    ]);
        console.error('Error in sending file:', error);
        throw error;
    }
}else{
    throw new Error(`INCOMPATIBLE_FILE_FORMAT`);
  
}
  
}
 

async function analyzeFileFromSlack(prompt, userId) {
   let getFileId = await searchFileId(userId)
    let result;
    try {
      let preparedModel = `your should answer with simple statements. it should be short and easy to understand.  here's the question: ${prompt}` 

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
         result = await model.generateContent([
            preparedModel,
            {
                fileData: {
                   fileUri: getFileId,
                    mimeType: "text/plain"
                },
            },
        ]);
    
    return  result?.response?.text() 

    } catch (error) {
        console.error('Error in analyzeFileFromSlack:', error);
        throw error;
    }
}


async function formatMessage(prompt){
    let formattedMessage = "No content available.";

    if (prompt && prompt.trim()) {          
      
        const sqlRegex = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE|COMMIT|ROLLBACK|SAVEPOINT|SET|EXEC|EXECUTE|DECLARE|BEGIN|END)\b/i;

        if (sqlRegex.test(prompt)) {  

            formattedMessage = `\`\`\`sql\n${prompt}\n\`\`\``.replace(/^\s*```sql\s*/i, '').replace(/\s*```\s*$/i, '').trim();;
          
      } else {
            // Send as regular text
            formattedMessage = prompt;
        }
    }

    return formattedMessage; 
}


async function handleExcelCommand({command, ack, respond, client }) {
  
  await ack();

  const { text, user_id, channel_id } = command;
 
  const prompt = text.trim(); 

  let userEmail = await findEmailByUserId(user_id);
     
  if(!userEmail){
      await respond("Please upload a file to create your profile.")
      return;
  }
  if (!prompt) {
    await respond('Kindly provide a detailed description of your request.');
    return;
  }else{
    await respond("Your request is being processed. Please note that larger files may take longer to complete");
  }
 
  try {
    let getFileId = await searchFileId(user_id)
 
    let preparedModel =  `The answer must be in raw json format. if the question isn't clear, ask user to be clear and don't return json. here is the question: ${prompt}.`
   
    let result = await model.generateContent([
            preparedModel,
            {
                fileData: {
                    fileUri: getFileId,
                    mimeType: "text/plain"
                },
            },
        ]);
       
     let jsonData; 
     let rawData = result.response.text();
   
    try {
      
        let parsedData = parseAIResponse(rawData);
        if (parsedData === null) {
            await respond("We're unable to process your request. Please try rephrasing and resubmitting.");
            return;
        } else if (parsedData.clarificationNeeded) {
            await respond(parsedData.message);
            return;
        }else{
            //coming soon
        }
        jsonData = parsedData
    } catch (error) {
       // console.log('error:', jsonData) 
        console.error("Error parsing JSON:", error);
    }
    //console.log('jsondata', jsonData)
    if (!jsonData) {
       console.log('error:', jsonData) 
      await respond("Something is wrong with the file."); //spit out information from LLM
      return;
    }

    // Ensure jsonData is an array of objects
    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    
    if (dataArray.length === 0 || typeof dataArray[0] !== 'object') {
      await respond('Invalid data structure.');
      return;
    }

    // Flatten nested objects
    const flattenedData = dataArray.map(item => flattenObject(item));
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');

    // Add headers
    const headers = Object.keys(flattenedData[0]);
    worksheet.addRow(headers);

    // Add data
    flattenedData.forEach(item => {
      worksheet.addRow(Object.values(item));
    });

    // Generate Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    

    // Upload file to Slack using the uploadV2 method
    const filename = Date.now()+`${channel_id}`+`.xlsx`
   
    try {
      const result = await client.files.uploadV2({
        channel_id: channel_id,
        filename: filename, 
        file: buffer,
        initial_comment: `Here's your excel sheet, <@${user_id}>!`,
      });
      if (result.ok && result.files && result.files.length > 0 && result.files[0].ok) {
       // await respond(`Spreadsheet created for ${email}. You can find it in this channel.`);
      } else {
        await respond('There was an error uploading the excel sheet. Please try again.');
      }
    } catch (uploadError) {
      //console.error('Error uploading file:', uploadError);
      await respond(`Error uploading file: ${uploadError.message}. Contact support if the issue persists.`);
    }
  } catch (error) {
    if (error.message.includes('429')) {
        await respond(`Error: Too Many Requests - Quota exceeded`);
        //console.error('Error: Too Many Requests - Quota exceeded');
        // Handle retry logic or notify user to wait before retrying
    } else if (error.message.includes('500')){
        await respond(`Please try to rephrase your prompt. Contact support if the issue persists`);
        console.error('Other Error:', error.message);
    }else{
        await respond(`An error occurred: ${error.message}. Contact support if the issue persists.`);
        console.error('Other Error:', error.message);
    }
  //  console.error('Error processing Excel command:', error);
   // await respond(`An error occurred: ${error.message}. Contact support if the issue persists.`);
  }
}

// Helper function to flatten nested objects
function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = Array.isArray(obj[k]) ? obj[k].join(', ') : obj[k];
    }
    return acc;
  }, {});
}


async function handleSpreadsheetCommand({command, ack, respond}) {
   // console.log('in search of team id:', command)

    const credentials = JSON.parse(process.env.GOOGLE_SHEET_KEY);
   
    const auth = new google.auth.GoogleAuth({
     // keyFile: './sheet.json', // Replace with the path to your service account key file
     credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    });
  
    await ack();
  
    const { text, user_id, channel_id } = command;
   // console.log('user_id:', user_id)
    let userEmail = await findEmailByUserId(user_id);

    if(!userEmail){
        await respond("Please upload a file to create your profile.")
        return;
    }

    const prompt = text.trim();
  
    if (!prompt) {
      await respond('Kindly provide a detailed description of your request.');
      return;
    }else{
        await respond("Your request is being processed. Please note that larger files may take longer to complete");
    }
  
    const sheets = google.sheets({ version: 'v4', auth });
    const drive = google.drive({ version: 'v3', auth });
  
    // Create a new spreadsheet
    const resource = {
      properties: {
        title: `Spreadsheet for ${userEmail}`,
      },
    };
  
    try {

        let getFileId = await searchFileId(user_id)
      
        let preparedModel =  `The answer must be in raw json format. if the question isn't clear, ask user to be clear and don't return json. here is the question: ${prompt}.`
      
           let result = await model.generateContent([
                preparedModel,
                {
                    fileData: {
                        fileUri: getFileId,
                        mimeType: "text/plain",  // Set to JSON format
                    }
                },
            ]);
            
            
         let jsonData; 
         let rawData = result.response.text();
           
        try {
        let parsedData = parseAIResponse(rawData);
        if (parsedData === null) {
            await respond("We're unable to process your request. Please try rephrasing and resubmitting.");
            return;
        } else if (parsedData.clarificationNeeded) {
            await respond(parsedData.message);
            return;
        }else{
            //coming soon
        }
        jsonData = parsedData
    } catch (error) {
        console.log('error:', jsonData) 
        console.error("Error parsing JSON:", error);
    }
      
        if (!jsonData) {
          await respond(rawData); //spit out information from LLM
          return;
        }


        // Ensure jsonData is an array of objects
        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        if (dataArray.length === 0 || typeof dataArray[0] !== 'object') {
          await respond('Invalid data structure.');
          return;
        }
    
    // Flatten nested objects
    const flattenedData = dataArray.map(item => flattenObject(item));

    const formattedData = formatDataForSheet(flattenedData);

      // Step 1: Create the spreadsheet
      const spreadsheet = await sheets.spreadsheets.create({
        resource,
      });
  
      // Use Block Kit to structure the message for link unfurling
      const message = {
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `Here's your spreadsheet, <@${user_id}>! ${spreadsheet.data.spreadsheetUrl}`
            }
          }
        ]
      };
 
      await respond(message);
    
      // Step 2: Populate the spreadsheet with dynamic data
    //  const formattedData = formatDataForSheet(data);
      await sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheet.data.spreadsheetId,
        range: 'Sheet1!A1', // Specify where to start populating the data
        valueInputOption: 'RAW',
        resource: {
          values: formattedData,
        },
      });
     // console.log('Spreadsheet populated with data');
  
      // Step 3: Grant editor permission to the user
      await drive.permissions.create({
        resource: {
          type: 'user',
          role: 'writer', // This gives full edit access, but not ownership
          emailAddress: userEmail,
        },
        fileId: spreadsheet.data.spreadsheetId,
        fields: 'id',
      });
  
    } catch (err) {
      console.error('Error creating or sharing spreadsheet:', err);
      await respond(`Error: ${err.message}`);
    }

  }

// Helper function to format any JSON data for Google Sheets
function formatDataForSheet(data) {
    let headers = [];
    let rows = [];

    if (Array.isArray(data)) {
        // Extract the keys from the first object as headers
        headers = Object.keys(data[0] || {});
        rows = data.map(item => headers.map(header => item[header]));
    } else if (typeof data === 'object') {
        // If it's a single object, treat keys as headers and values as a single row
        headers = Object.keys(data);
        rows = [Object.values(data)];
    } else {
        throw new Error('Unsupported data format. Please provide an object or array of objects.');
    }

    return [headers, ...rows];

}



function parseAIResponse(rawData) {
    // Remove any backticks or other unwanted characters
    let cleanedRaw = rawData.replace(/```json|```/g, '').trim();
    
    try {
      // Attempt to parse with JSON5 (more lenient than JSON.parse)
      return JSON5.parse(cleanedRaw);
    } catch (parseError) {
      console.error("Error parsing JSON:", parseError);
      
      // Check if the response is a request for clarification
      if (cleanedRaw.toLowerCase().includes("please clarify") || cleanedRaw.toLowerCase().includes("could you provide more details")) {
        return { clarificationNeeded: true, message: cleanedRaw };
      }
      
      // If all else fails, return null to indicate parsing failure
      return null;
    }
  }

export {formatMessage, handleExcelCommand, sendFileToGemini, handleSpreadsheetCommand, getUserEmail, analyzeFileFromSlack};