module.exports = (sequelize, DataTypes) => {
  const Account = sequelize.define(
    'Account',
    {
      AccountId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'AccountId',
      },
      Name: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Name',
      },
      UserName: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'UserName',
      },
      Password: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'Password',
      },
      Code: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Code',
      },
      DepartmentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'DepartmentId',
        references: {
          model: 'Department',
          key: 'DepartmentId',
        },
      },
      PermissionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'PermissionId',
        references: {
          model: 'Permission',
          key: 'PermissionId',
        },
      },
      OwnerId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'OwnerId',
        references: {
          model: 'Owner',
          key: 'OwnerId',
        },
      },
      CreateDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'CreateDate',
      },
      Images: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Images',
      },
    },
    {
      tableName: 'Account',
      timestamps: false,
    }
  );

  Account.associate = (models) => {
    if (models.Department) {
      Account.belongsTo(models.Department, {
        foreignKey: 'DepartmentId',
        as: 'department',
      });
    }
    if (models.Permission) {
      Account.belongsTo(models.Permission, {
        foreignKey: 'PermissionId',
        as: 'permission',
      });
    }
    if (models.Owner) {
      Account.belongsTo(models.Owner, {
        foreignKey: 'OwnerId',
        as: 'owner',
      });
    }
  };

  return Account;
};
