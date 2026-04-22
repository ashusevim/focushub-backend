import mongoose, { model } from "mongoose";

const { Schema } = mongoose;

// Schema corresponding to the document interface.
const userSchema = new Schema({
    username: {
    	type: String,
    	required: true,
    	unique: true,
    	lowercase: true,
    },
    email: {
    	type: String,
     	required: true,
      	lowercase: true,
       	unique: true,
    },
    password: {
    	type: String,
     	required: true,
    }
}, {timestamps: true});

export const User = model("User", userSchema);
