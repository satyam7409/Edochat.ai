import { Router } from "express";
import { signup, login, logout, refresh } from "../controllers/user.controllers";
import { authRateLimiter } from "../middlewares/rateLimitor.middleware";

const route = Router();


route.post("/signup", authRateLimiter, signup);
route.post("/login", authRateLimiter, login);
route.post("/refresh", refresh);
route.post("/logout", logout);

export default route;
