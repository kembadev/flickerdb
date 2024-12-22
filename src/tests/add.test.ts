import { expect } from 'chai';
import { FlickerDB } from '../core/flicker.js';
import fs from 'node:fs';

describe('add method', () => {
	const file = 'add.test.json';
	const db = new FlickerDB<string>(file);

	afterEach(async () => {
		await db.clearAll();
	});

	after(() => {
		fs.unlinkSync(file);
	});

	it('should add entries', async () => {
		const data = ['data1', 'data2'];
		const ids = await db.add(data);

		expect(ids).to.have.lengthOf(2);

		const [data1, data2] = data;
		const [id1, id2] = ids;

		const expectedContent = JSON.stringify({ [id1]: data1, [id2]: data2 });
		const actualContent = fs.readFileSync(file, { encoding: 'utf-8' });
		expect(actualContent).to.equal(expectedContent);
	});
});
