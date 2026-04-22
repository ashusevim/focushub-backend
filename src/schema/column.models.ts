import mongoose, { model } from 'mongoose';

const { Schema } = mongoose;

const columnSchema = new Schema({
	title: {
		type: String,
		required: true,
	},
	numberOftasks: {
		type: Number,
		default: 0,
	},
	tags: {
		type: [String],
	},
	description: {
		type: String,
	},
	tasks: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Task"
		}
	]
}, { timestamps: true })

export const column = model('Column', columnSchema);
