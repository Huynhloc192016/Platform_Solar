module.exports = (sequelize, DataTypes) => {
  const MenuChild = sequelize.define(
    'MenuChild',
    {
      Id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      MenuId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Menu',
          key: 'Id',
        },
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
      tableName: 'MenuChild',
      timestamps: false,
    }
  );

  MenuChild.associate = (models) => {
    if (models.Menu) {
      MenuChild.belongsTo(models.Menu, {
        foreignKey: 'MenuId',
        as: 'menu',
      });
    }
  };

  return MenuChild;
};
