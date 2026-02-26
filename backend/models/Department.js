module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define(
    'Department',
    {
      DepartmentId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'DepartmentId',
      },
      DepartmentName: {
        type: DataTypes.STRING,
        allowNull: true,
        field: 'DepartmentName',
      },
    },
    {
      tableName: 'Department',
      timestamps: false,
    }
  );

  Department.associate = (models) => {
    if (models.Account) {
      Department.hasMany(models.Account, {
        foreignKey: 'DepartmentId',
        as: 'accounts',
      });
    }
  };

  return Department;
};
