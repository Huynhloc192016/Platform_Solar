module.exports = (sequelize, DataTypes) => {
  const Permission = sequelize.define(
    'Permission',
    {
      PermissionId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'PermissionId',
      },
      Name: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Name',
      },
      Description: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Description',
      },
      CreateDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'CreateDate',
      },
      MenuID: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'MenuID',
      },
      MenuName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'MenuName',
      },
    },
    {
      tableName: 'Permission',
      timestamps: false,
    }
  );

  Permission.associate = (models) => {
    if (models.Account) {
      Permission.hasMany(models.Account, {
        foreignKey: 'PermissionId',
        as: 'accounts',
      });
    }
  };

  return Permission;
};
