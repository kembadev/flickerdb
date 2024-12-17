import z from 'zod';
import fastJson from 'fast-json-stringify';
import { FlickerDB } from '../core/flicker.js';
import express from 'express';

const taskSchema = z.object({
	title: z.string(),
	description: z.string(),
});

function validateTask(task: unknown) {
	return taskSchema.safeParse(task);
}

type Task = z.infer<typeof taskSchema> & {
	createdAt: string;
};

const stringify = fastJson({
	title: 'task schema',
	type: 'object',
	properties: {
		title: {
			type: 'string',
		},
		description: {
			type: 'string',
		},
		createdAt: {
			type: 'string',
			format: 'date-time',
		},
	},
});

const tasksDB = new FlickerDB<Task>('db/tasks', {
	overwrite: false,
	stringify,
});

const app = express();

app.use(express.json());

app.post('/task', (req, res) => {
	const { success, error, data } = validateTask(req.body);

	if (!success) {
		res.status(400).send(error.message);

		return;
	}

	const task: Task = {
		...data,
		createdAt: new Date().toISOString(),
	};

	tasksDB
		.addOne(task)
		.then(id => {
			res.status(201).send(`task created successfully! id: ${id}`);
		})
		.catch(() => {
			res.status(500).send('something went wrong creating the task');
		});
});

app.listen(3000, () => {
	console.log('Server running on port 3000');
});
