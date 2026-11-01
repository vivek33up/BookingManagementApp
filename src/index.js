import express from "express";
import { env } from "./config/env.js";
import { db } from "./db/index.js";
import authRouter from "./modules/auth/auth.routes.js";
import resourcesRouter from "./modules/resources/resources.routes.js";
import bookingsRouter from "./modules/bookings/bookings.routes.js";
const app=express();
const PORT=3000;
app.use(express.json());
app.get("/",(req,res)=>{
    res.send("Booking system API is running");
})
//just to test whether app can reach the database
app.get("/health", async (req, res) => {
  try {
    await db.execute("select 1");
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});
app.use("/auth", authRouter);
app.use("/resources", resourcesRouter);
app.use("/bookings", bookingsRouter);
app.listen(PORT,()=>{
    console.log(`Server is listening on PORT ${PORT}`);
})
