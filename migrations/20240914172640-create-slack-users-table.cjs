'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('slack_users', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      channel_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      created: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      deleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      last_use: {
        type: Sequelize.DATE
      },
      log: {
        type: Sequelize.TEXT
      },
      file: {
        type: Sequelize.TEXT
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('slack_users');
  }
};
