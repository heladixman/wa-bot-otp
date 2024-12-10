const express = require("express");
const socketIo = require("socket.io");
const http = require("http");
const { Client } = require("whatsapp-web.js");
const Joi = require("joi");
const QRCode = require("qrcode");
const path = require("path");
const db = require("./src/config/db");
const bcrypt = require("bcrypt");

const PORT = process.env.PORT || 8080

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:8080", // or use '*' for all origins during development
    methods: ["GET", "POST"],
  },
});

app.use(express.json());

app.set("view engine", "ejs");
if (process.env.NODE_ENV === 'PRODUCTION') {
  app.use(express.static(path.join(__dirname, 'dist', 'public')));
  app.set("views", path.join(__dirname, "views"));
} else {
  app.use(express.static(path.join(__dirname, 'src', 'public')));
  app.set("views", path.join(__dirname, "src", "views"));
}


const client = new Client();

let whatsAppLogin = false;

client.on("qr", (qr) => {
  // Generate QR code and send to client
  if (!whatsAppLogin) {
    QRCode.toDataURL(qr, function (err, url) {
      if (err) {
        console.error("Error generating QR code:", err);
        return;
      }
      io.emit("qr", url); // Emit the QR code to all connected clients
    });
  }
});

client.on("ready", () => {
  whatsAppLogin = true;
  const clientNumber = client.info.wid.user;

  io.emit("login", { status: "success", clientNumber });
});

client.on("disconnected", () => {
  whatsAppLogin = false;
  io.emit("logout", { status: "success", message: "Logged out successfully" });
});

io.on("connection", (socket) => {
  socket.on("connect", () => {
    console.log("Connected to the server!");
  });

  socket.on("clientMessage", (data) => {
    console.log("Received from client:", data);
  });
});

let login = false;

app.get("/login", (req, res) => {
  if (login) {
    return res.redirect("/");
  }
  res.render("index");
});

app.get("/", (req, res) => {
  if (!login) {
    return res.redirect("/login");
  }
  return res.render("dashboard");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Validate the input using Joi
  const schema = Joi.object({
    username: Joi.string().min(3).required().messages({
      "string.base": "Username must be a string",
      "string.empty": "Username cannot be empty",
      "string.min": "Username must be at least 3 characters long",
      "any.required": "Username is required",
    }),
    password: Joi.string().min(6).required().messages({
      "string.base": "Password must be a string",
      "string.empty": "Password cannot be empty",
      "string.min": "Password must be at least 6 characters long",
      "any.required": "Password is required",
    }),
  });

  const { error } = schema.validate({ username, password });

  if (error) {
    return res.status(400).json({
      code: 400,
      status: "Bad Request",
      message: error.details[0].message,
    });
  }

  try {
    const userQuery = await db
      .collection("whatsappLogin")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return res.status(401).json({
        code: 401,
        status: "Unauthorized",
        message: "Account not found",
      });
    }

    const user = userQuery.docs[0].data();

    if (!user.password) {
      return res.status(500).json({
        code: 500,
        status: "Internal Server Error",
        message: "Password is missing or not hashed in the database.",
      });
    }

    const checkPassword = await bcrypt.compare(password, user.password);

    if (!checkPassword) {
      return res.status(401).json({
        code: 401,
        status: "Unauthorized",
        message: "Wrong username or password",
      });
    }
    return res.status(200).send({ code: 200, status: "success", message: "Successfully login" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 500,
      status: "Internal Server Error",
      message: "An error occurred while processing your request",
    });
  }
});

app.get("/login/process", (req, res) => {
  login = true;
  return res.redirect("/");
});

app.get("/logout", (req, res) => {
  login = false;
  return res.redirect("/login");
});

app.post("/admin/whatsapp/send-message", async (req, res) => {
  const { phone_number, message } = req.body;

  const schema = Joi.object({
    phone_number: Joi.string().required().messages({
      "string.empty": "Phone number is required",
    }),
    message: Joi.string().required().messages({
      "string.empty": "Message is required",
    }),
  });

  const { error } = schema.validate({ phone_number, message });

  if (error) {
    return res
      .status(400)
      .send({ code: 400, status: "Bad Request", message: error.message });
  }

  if (!whatsAppLogin) {
    return res.status(400).send({
      code: 400,
      status: "Failed",
      message: "WhatsApp is not logged in. Please scan the QR code to log in.",
    });
  }

  try {
    client.sendMessage(`${phone_number}@c.us`, message);
    return res.status(200).send({
      code: 200,
      status: "Success",
      message: "Message sent successfully",
    });
  } catch (error) {
    return res.status(500).send({
      code: 500,
      status: "Internal Server Error",
      message: error.message,
    });
  }
});

app.post("/admin/whatsapp/logout", (req, res) => {
  if (!whatsAppLogin) {
    return res.status(400).send({
      code: 400,
      status: "Failed",
      message: "WhatsApp is already logged out.",
    });
  }
  whatsAppLogin = false;
  client.destroy();
  return res.status(200).send({
    code: 200,
    status: "Success",
    message: "Successfully Logout",
  });
});

app.get("/*", (req, res) => {
  res.render("404");
});

client.initialize();

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
