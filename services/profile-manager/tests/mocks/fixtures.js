export const fixtures = {
  userId: "507f1f77bcf86cd799439011",
  user: {
    _id: "507f1f77bcf86cd799439011",
    email: "john@example.com",
    name: "John",
    roles: ["user"],
    password: "hashed-password",
    save: async function save() {
      return this;
    },
  },
  signupBody: {
    email: "john@example.com",
    password: "Password@123",
    name: "John",
  },
  loginBody: {
    email: "john@example.com",
    password: "Password@123",
  },
};
