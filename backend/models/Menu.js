module.exports = (sequelize, DataTypes) => {
  const Menu = sequelize.define(
    'Menu',
    {
      Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      Name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      Icon: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      Path: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      Order: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      Status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      DateCreate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      DateUpdate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'Menu',
      timestamps: false,
    }
  );

  Menu.associate = (models) => {
    if (models.MenuChild) {
      Menu.hasMany(models.MenuChild, {
        foreignKey: 'MenuId',
        as: 'children',
      });
    }
  };

  return Menu;
};
