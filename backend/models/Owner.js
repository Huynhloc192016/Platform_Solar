module.exports = (sequelize, DataTypes) => {
  const Owner = sequelize.define(
    'Owner',
    {
      OwnerId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'OwnerId',
      },
      Name: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Name',
      },
      Address: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Address',
      },
      Phone: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Phone',
      },
      Email: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'Email',
      },
      CreateDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'CreateDate',
      },
      Status: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'Status',
      },
    },
    {
      tableName: 'Owner',
      timestamps: false,
    }
  );

  Owner.associate = (models) => {
    if (models.Account) {
      Owner.hasMany(models.Account, {
        foreignKey: 'OwnerId',
        as: 'accounts',
      });
    }
    // if (models.ChargeStation) {
    //   Owner.hasMany(models.ChargeStation, {
    //     foreignKey: 'OwnerId',
    //     as: 'chargeStations',
    //   });
    // }
    // if (models.ChargePoint) {
    //   Owner.hasMany(models.ChargePoint, {
    //     foreignKey: 'OwnerId',
    //     as: 'chargePoints',
    //   });
    // }
    // if (models.UserApp) {
    //   Owner.hasMany(models.UserApp, {
    //     foreignKey: 'OwnerId',
    //     as: 'userApps',
    //   });
    // }
  };

  return Owner;
};
