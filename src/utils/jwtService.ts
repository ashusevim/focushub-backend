import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

export const generateToken = (payload: any) => {
    // it basically signs the payload with the secret key and returns a token
    return jwt.sign(payload, process.env.JWT_SECRET_KEY as string, { expiresIn: "1h" });
}

export const verifyToken = (token: string) => {
    // it basically verifies the token with the secret key and returns the payload
    return jwt.verify(token, process.env.JWT_SECRET_KEY as string)
}