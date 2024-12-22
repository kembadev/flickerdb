import { expect } from 'chai';
import { FlickerDB } from '../core/flicker.js';
import fs from 'node:fs';
import {
	FLICKER_ERROR_CODES,
	FlickerError,
} from '../error-handling/flicker.js';

describe('FlickerDB', () => {
	const file = 'flickerdb.test.json';
	new FlickerDB(file);

	after(() => {
		fs.unlinkSync(file);
	});

	it('should create db file', () => {
		expect(fs.existsSync(file)).to.be.equal(true);

		const dbContent = fs.readFileSync(file, { encoding: 'utf-8' });
		expect(dbContent).to.be.equal('{}');
	});

	it('should throw error', () => {
		expect(() => new FlickerDB(file))
			.to.throw(FlickerError)
			.with.property('code', FLICKER_ERROR_CODES.INVALID_PARAMS);
	});
});
