import { expect } from 'chai';
import { FlickerDB } from '../core/flicker.js';
import fs from 'node:fs';

describe('clearAll method', () => {
	const file = 'clear-all.test.json';
	const db = new FlickerDB<string>(file);

	after(() => {
		fs.unlinkSync(file);
	});

	it('should clear db', async () => {
		const data = ['a', 'b'];
		await db.add(data);

		await db.clearAll();

		const dbContent = fs.readFileSync(file, { encoding: 'utf-8' });
		expect(dbContent).to.be.equal('{}');
	});
});
