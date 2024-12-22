import { expect } from 'chai';
import { FlickerDB } from '../core/flicker.js';
import fs from 'node:fs';

describe('update method', () => {
	const file = 'update.test.json';
	const db = new FlickerDB<string>(file);

	afterEach(async () => {
		await db.clearAll();
	});

	after(() => {
		fs.unlinkSync(file);
	});

	it('should update entries', async () => {
		const data = ['update me', 'data'];
		await db.add(data);

		const updatedEntries = await db.update(({ data }) => {
			if (data === 'update me') return 'new value';
		});
		expect(updatedEntries).to.be.equal(1);
	});

	it('should not update any entry', async () => {
		await db.addOne('data');

		const updatedEntries = await db.update(() => undefined);
		expect(updatedEntries).to.be.equal(undefined);
	});

	it('should not modify db', async () => {
		await db.update(() => undefined);

		const dbContent = fs.readFileSync(file, { encoding: 'utf-8' });
		expect(dbContent).to.be.equal('{}');
	});
});
