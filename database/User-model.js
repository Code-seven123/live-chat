import sequelize from "./db.js"
import { DataTypes } from 'sequelize';
import { generateNumericId } from "../lib/myfunc.js"
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  uuid: {
    type: DataTypes.INTEGER,
    defaultValue: generateNumericId(),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  // Opsi lainnya
  tableName: 'users',
  timestamps: true,
});

// Sinkronkan model dengan database
sequelize.sync()
  .then(() => {
    console.log('User table has been created.');
  })
  .catch(err => {
    console.error('Unable to create table:', err);
  });

export default User;
