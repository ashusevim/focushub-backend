import mongoose from "mongoose";
import dotenv from "dotenv";
import { DB_NAME } from "../constant.js";
dotenv.config();

export async function DBConnect() {
    try {
        const URI = process.env.DB_URI;
        const connectionInstance = await mongoose.connect(`${URI}/${DB_NAME}`);
        console.log(`MongoDB connected to ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log(`MongoDB connection error: ${error}`);
        process.exit(1);
    }
}