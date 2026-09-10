import { Router } from "express";
import { signup, login } from "../controllers/user.controllers";
import { authRateLimiter } from "../middlewares/rateLimitor.middleware";

const route = Router();


route.post("/signup", authRateLimiter, signup);
route.post("/login", authRateLimiter, login);

export default route;
