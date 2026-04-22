import mongoose, { model } from 'mongoose';
import { ref } from 'node:process';

const { Schema } = mongoose;

const taskSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    columnId: {
        type: String,
        required: true,
        enum: ["todo", "inprogress", "done"],
        default: "todo",
        index: true
    },
	title: {
		type: String,
		required: true,
        trim: true
    },
	tags: {
		type: [String],
        default: [],
	},
	description: {
		type: String,
        default: "",
        trim: true
	},
    order: {
        type: Number,
        default: 0,
        index: true
    },
}, { timestamps: true })

taskSchema.index({
    userId: 1,
    columnId: 1,
    order: 1
})

export const task = model('Task', taskSchema);
