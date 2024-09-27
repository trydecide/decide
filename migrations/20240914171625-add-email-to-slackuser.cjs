'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add the email column to the slack_users table
    await queryInterface.addColumn('slack_users', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the email column from the slack_users table
    await queryInterface.removeColumn('slack_users', 'email');
  }
};
