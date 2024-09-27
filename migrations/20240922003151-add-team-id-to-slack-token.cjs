'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('slack_token', 'team_id', {
      type: Sequelize.STRING,
      allowNull: true, // Temporarily allow null for existing records
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('slack_token', 'team_id');
  }
};
