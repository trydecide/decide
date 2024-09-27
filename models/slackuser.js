import { Model, DataTypes } from 'sequelize';

export default (sequelize) => {
  class SlackUser extends Model {
    static associate(models) {
      // Define associations here
    }
  }

  SlackUser.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    channel_id: {
      type: DataTypes.STRING,
      allowNull: false
    },
    user_id: {
      type: DataTypes.STRING,
      allowNull: false
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false
      },

    created: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    last_use: {
      type: DataTypes.DATE
    },
    log: {
      type: DataTypes.TEXT
    },
    file: {
      type: DataTypes.TEXT
    }
  }, {
    sequelize,
    modelName: 'SlackUser',
    tableName: 'slack_users',
    timestamps: false,
    paranoid: true
  });

  return SlackUser;
};
