import { server } from "./app.js";

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`API Gateway (and WebSocket) running on port ${PORT}`);
});
