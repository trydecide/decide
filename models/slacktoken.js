import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class SlackToken extends Model {
    static associate(models) {
      // Define associations here
    }
  }

  SlackToken.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    bot_token: {
      type: DataTypes.STRING,
      allowNull: false
    },
    app_token: {
      type: DataTypes.STRING,
      allowNull: false
    },
    team_id: {
        type: DataTypes.STRING,
        allowNull: false
      },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'SlackToken',
    tableName: 'slack_token',
    timestamps: false,
    paranoid: true
  });

  return SlackToken;
};
