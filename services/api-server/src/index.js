import { server } from "./app.js";

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`API Gateway (and WebSocket) running on port ${PORT}`);
});
