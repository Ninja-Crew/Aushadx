import app from "./app.js";

const port = process.env.API_PORT || 4000;

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API server listening on ${port}`);
});

export default server;
