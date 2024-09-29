# Decide

**Decide** is an AI-powered tool that helps you extract insights and generate spreadsheets from your data using plain English.

To install on slack, please visit the homepage at [https://www.trydecide.co/](https://www.trydecide.co/)

## Setup Instructions

1. Contact us at `dev@trydecide.co` or send a DM to [@Abiodun0x](https://twitter.com/Abiodun0x) or the official project page on Twitter [@trydecide_](https://twitter.com/trydecide_) for **free assistance** in setting up Decide on your Slack workspace.

2. Read the instructions below. 


### Step 1: Create a Slack App
1. Go to [Slack Apps](https://app.slack.com/) and create a new Slack app within your workspace.
2. Once the app is created, navigate to its page.

### Step 2: Configure the App Manifest
1. In the left menu, scroll to **App Manifest** under the **Features** section.
2. Copy the contents from the `manifest.json` file in this repository and paste them into the Slack **App Manifest** section.

### Step 3: Deploy the Project
1. Push the project to the server. The project is pre-configured for deployment on **Heroku**.

### Step 4: Set Environment Variables
1. Ensure all required environment variables are correctly set on your server. You can refer to the `.env.example` file for a list of variables.

### Step 5: Migrate the Database
1. Run the necessary database migrations using Sequelize.





## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License. See the [LICENSE](LICENSE) file for details.

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)